import {
    describeTaskError,
    hasEmptyBasicCredentials,
    isCarrierTaskError,
    type CarrierRequestError,
    type XenvioTaskError,
} from '../domain/carriers/carrier-errors';

/**
 * How a carrier failure is presented in the report — pure logic, no Playwright.
 *
 * Texts here are read by QA in Allure, so they are in Spanish (like the Allure categories).
 * Classification is intentionally strict. Rate shopping queries many carriers and some of
 * them fail on every run (noise), so an error in the log alone never marks a failure as
 * external. Only two signals do:
 *   1. A Xenvio task (label, void_label, return_label, ...) was rejected by the carrier.
 *   2. The rates modal shows "No shipping rates are available" and carriers failed.
 *
 * Covered by v2/unit/carrier-failure-report.unit.spec.ts.
 */

export const CARRIER_FAILURE_TAG = '[CARRIER EXTERNO]';
/** The tag as a regex fragment, for the Allure categories in playwright.config.ts. */
export const CARRIER_FAILURE_TAG_PATTERN = CARRIER_FAILURE_TAG.replace(/[[\]]/g, '\\$&');

export interface CarrierFailureEvidence {
    taskErrors: XenvioTaskError[];
    carrierErrors: CarrierRequestError[];
    noRatesVisible: boolean;
}

export function formatCarrierError(error: CarrierRequestError): string {
    const status = error.status ?? 'sin respuesta';
    const code = error.code && error.code !== String(error.status) ? ` ${error.code}` : '';
    const credentials = error.emptyCredentials ? ' (credenciales vacías en la cuenta del carrier)' : '';
    return `${error.carrier} ${status}${code}: ${error.message}${credentials}`;
}

function uniqueCarrierErrors(errors: CarrierRequestError[], limit: number): CarrierRequestError[] {
    const seen = new Set<string>();
    return errors.filter((error) => {
        const key = `${error.carrier}|${error.status}|${error.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, limit);
}

/**
 * One-line reason to prepend to the test error, or null when the failure should NOT be
 * classified as an external carrier problem.
 */
export function buildCarrierFailureReason(evidence: CarrierFailureEvidence): string | null {
    const carrierTaskError = [...evidence.taskErrors].reverse().find((task) => isCarrierTaskError(task.error));
    if (carrierTaskError) {
        return `${CARRIER_FAILURE_TAG} La tarea "${carrierTaskError.task ?? 'desconocida'}" fue rechazada por el carrier: `
            + describeTaskError(carrierTaskError.error);
    }

    if (evidence.noRatesVisible && evidence.carrierErrors.length > 0) {
        const details = uniqueCarrierErrors(evidence.carrierErrors, 3).map(formatCarrierError).join(' | ');
        return `${CARRIER_FAILURE_TAG} Sin rates disponibles; los carriers respondieron con error: ${details}`;
    }
    return null;
}

// ─── Redaction (the Allure report is shared) ─────────────────────────────

const SENSITIVE_KEY = /authorization|api[-_]?key|apikey|password|passwd|secret|token|credential|client[-_]?id|meter[-_]?number|account[-_]?number|^key$/i;
const REDACTED = '[REDACTED]';

function redactString(text: string): string {
    return text
        // Credentials in a URL query string: ?api_key=..., &token=..., &sig=...
        .replace(
            /([?&](?:api[-_]?key|apikey|key|token|access[-_]?token|password|passwd|secret|client[-_]?secret|sig|signature|auth)=)([^&#"'\s]+)/gi,
            `$1${REDACTED}`,
        )
        // Ruby hash inspect / JSON inside strings: "Authorization"=>"Basic xxx" or "api_key":"xxx"
        .replace(
            /("?(?:authorization|api[-_]?key|apikey|password|passwd|secret|token|client[-_]?secret)"?\s*(?:=>|:)\s*")([^"]*)(")/gi,
            (_match, start: string, value: string, end: string) =>
                `${start}${REDACTED}${hasEmptyBasicCredentials(value) ? ' (empty credentials)' : ''}${end}`,
        )
        // XML credentials: <Password>..</Password>, <v1:Key>..</v1:Key>, ...
        .replace(
            /<((?:\w+:)?(?:Password|Key|Secret|Token|MeterNumber|AccountNumber|UserId|Username|AccessLicenseNumber))>[^<]*<\/\1>/gi,
            `<$1>${REDACTED}</$1>`,
        );
}

/** Deep copy with credentials masked in keys, Ruby-hash strings and XML bodies. */
export function redactSensitive(value: unknown, depth = 0): unknown {
    if (depth > 12) return value;
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, child]) => {
                if (SENSITIVE_KEY.test(key) && (typeof child === 'string' || typeof child === 'number')) {
                    const note = hasEmptyBasicCredentials(child) ? ' (empty credentials)' : '';
                    return [key, `${REDACTED}${note}`];
                }
                return [key, redactSensitive(child, depth + 1)];
            }),
        );
    }
    return value;
}
