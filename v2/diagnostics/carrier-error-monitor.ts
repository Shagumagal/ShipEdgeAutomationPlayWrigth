import { BrowserContext, Response, TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import {
    isFailedOutgoing,
    isOutgoingSince,
    summarizeCarrierErrors,
    type OutgoingRecord,
    type XenvioTaskError,
} from '../domain/carriers/carrier-errors';
import { buildCarrierFailureReason, formatCarrierError, redactSensitive } from './carrier-failure-report';

/** Rows created this long before the test started still count (server vs local clock skew). */
const CLOCK_SKEW_TOLERANCE_MS = 2 * 60 * 1000;
/** Only the most recently touched shipments are inspected (batch tests touch many). */
const MAX_SHIPMENTS_TO_INSPECT = 5;
const VIEW_REQUESTS_TIMEOUT_MS = 15000;
/** Truncates huge bodies (labels in base64, XML manifests) inside the attachment. */
const MAX_BODY_CHARS = 20000;
/** Successful task_executor payloads bigger than this are not parsed while watching for errors. */
const MAX_READABLE_BODY_BYTES = 512 * 1024;

const SHIPMENT_URL = /^(https?:\/\/[^/]+)\/shipments\/(\d+)(?:[/?#]|$)/;
const NO_RATES_TEXT = /No shipping rates are available/i;

/**
 * Watches the Xenvio backend calls of one test. When the test fails it reads the carrier
 * request log (View Requests → `view_requests2`) of the shipments it touched, attaches the
 * failed carrier calls to Allure and, when the evidence is strong enough, prefixes the test
 * error with `[CARRIER EXTERNO]` so Allure files it under "Error externo de carrier".
 *
 * Never throws: a diagnostics problem must not change a test result.
 */
export class CarrierErrorMonitor {
    private readonly startedAt = Date.now();
    private readonly shipments = new Map<string, string>(); // shipment id → backend origin
    private readonly taskErrors: XenvioTaskError[] = [];
    private readonly listener = (response: Response) => { void this.onResponse(response); };

    constructor(private readonly context: BrowserContext) {
        context.on('response', this.listener);
    }

    private async onResponse(response: Response): Promise<void> {
        try {
            const url = response.url();
            const match = url.match(SHIPMENT_URL);
            if (!match) return;

            const [, origin, shipmentId] = match;
            this.shipments.delete(shipmentId); // re-insert → keeps "most recent" order
            this.shipments.set(shipmentId, origin);

            if (url.includes('task_executor') && this.canReadBody(response)) {
                // Xenvio can answer 2xx with `{ error }`, so the body decides, not only the status.
                const body = await response.json().catch(() => null) as { error?: unknown } | null;
                const bodyError = body && typeof body === 'object' ? body.error : null;

                if (response.status() >= 400 || bodyError) {
                    const task = new URL(url).searchParams.get('task');
                    this.taskErrors.push({ task, status: response.status(), error: bodyError ?? body });
                }
            }
        } catch {
            // Diagnostics only.
        }
    }

    /** Skips huge 2xx payloads (labels in base64): reading them is not worth it for diagnostics. */
    private canReadBody(response: Response): boolean {
        if (response.status() >= 400) return true;
        const length = Number(response.headers()['content-length'] ?? 0);
        return !length || length <= MAX_READABLE_BODY_BYTES;
    }

    async finish(testInfo: TestInfo): Promise<void> {
        this.context.off('response', this.listener);
        if (testInfo.status === testInfo.expectedStatus || !testInfo.error) return;

        try {
            const outgoings = await this.fetchOutgoings();
            const since = new Date(this.startedAt - CLOCK_SKEW_TOLERANCE_MS).toISOString();
            const carrierErrors = summarizeCarrierErrors(outgoings.map(({ record }) => record), since);
            const noRatesVisible = await this.isNoRatesModalVisible();

            if (carrierErrors.length > 0 || this.taskErrors.length > 0) {
                await this.attachEvidence(outgoings, since, carrierErrors.map(formatCarrierError));
            }

            const reason = buildCarrierFailureReason({ taskErrors: this.taskErrors, carrierErrors, noRatesVisible });
            if (reason) {
                console.warn(`\n${reason}\n`);
                testInfo.annotations.push({ type: 'carrier-error', description: reason });
                // `message` feeds the Allure categories; `stack` is what the HTML/list reporters print.
                const { message, stack } = testInfo.error;
                testInfo.error = {
                    ...testInfo.error,
                    message: `${reason}\n\n${message ?? ''}`,
                    ...(stack ? { stack: `${reason}\n\n${stack}` } : {}),
                };
            }
        } catch (error) {
            console.warn(`⚠️ Carrier diagnostics skipped: ${(error as Error).message}`);
        }
    }

    private async fetchOutgoings(): Promise<Array<{ shipmentId: string; record: OutgoingRecord }>> {
        const recent = [...this.shipments.entries()].slice(-MAX_SHIPMENTS_TO_INSPECT);
        const results = await Promise.all(recent.map(async ([shipmentId, origin]) => {
            try {
                const response = await this.context.request.get(`${origin}/shipments/${shipmentId}/view_requests2`, {
                    headers: { Accept: 'application/json' },
                    timeout: VIEW_REQUESTS_TIMEOUT_MS,
                });
                if (!response.ok()) return [];
                const rows = await response.json() as OutgoingRecord[];
                return Array.isArray(rows) ? rows.map((record) => ({ shipmentId, record })) : [];
            } catch {
                return [];
            }
        }));
        return results.flat();
    }

    private async isNoRatesModalVisible(): Promise<boolean> {
        for (const page of this.context.pages()) {
            if (page.isClosed()) continue;
            const visible = await page.getByText(NO_RATES_TEXT).first().isVisible().catch(() => false);
            if (visible) return true;
        }
        return false;
    }

    private async attachEvidence(
        outgoings: Array<{ shipmentId: string; record: OutgoingRecord }>,
        since: string,
        summary: string[],
    ): Promise<void> {
        const failedCalls = outgoings
            .filter(({ record }) => isOutgoingSince(record, since) && isFailedOutgoing(record))
            .map(({ shipmentId, record }) => ({
                shipmentId,
                createdAt: record.created_at,
                request: {
                    method: record.request_method,
                    // Some carriers put credentials in the query string.
                    url: redactSensitive(record.request_url),
                    headers: redactSensitive(record.request_header),
                    body: clip(redactSensitive(record.request_body)),
                },
                response: {
                    code: record.response_code,
                    body: clip(redactSensitive(record.response_body)),
                },
            }));

        const evidence = redactSensitive({
            note: 'Llamadas a carriers con error durante este test (View Requests / view_requests2). Credenciales enmascaradas.',
            summary,
            xenvioTaskErrors: this.taskErrors,
            failedCarrierCalls: failedCalls,
        });
        await allure.attachment('Carrier errors (View Requests)', JSON.stringify(evidence, null, 2), 'application/json');
    }
}

function clip(value: unknown): unknown {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}… [truncated]` : value;
}
