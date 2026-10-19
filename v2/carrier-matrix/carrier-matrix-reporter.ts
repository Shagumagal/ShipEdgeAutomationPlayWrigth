import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import {
    CARRIER_MATRIX_ENTRY_ANNOTATION,
    CARRIER_MATRIX_RECORD_ATTACHMENT,
    fallbackProbeRecord,
    renderMatrixMarkdown,
    summarizeMatrix,
    type CarrierProbeRecord,
} from '../domain/carriers/carrier-matrix';
import { loadCarrierMatrixConfig } from '../config/carrier-matrix-config';
import { CARRIER_FAILURE_TAG } from '../diagnostics/carrier-failure-report';
import { stripAnsiCodes } from '../diagnostics/failure-summary';

const OUTPUT_DIR = 'carrier-matrix-report';

/**
 * Collects the result of every carrier matrix test (v2/carrier-matrix/carrier-matrix.spec.ts)
 * and, at the end of the run, prints the matrix and writes it to carrier-matrix-report/:
 *   latest-<mode>.md / latest-<mode>.json  this run (the .json is compared with the next run)
 *   history/<date>-<mode>.json             every run, to follow a carrier over time
 *
 * Registered in playwright.config.ts for every run; it does nothing when no matrix test ran.
 */
export default class CarrierMatrixReporter implements Reporter {
    /** Last attempt of each test wins (retries). */
    private readonly records = new Map<string, CarrierProbeRecord>();

    onTestEnd(test: TestCase, result: TestResult): void {
        const entryId = test.annotations.find((annotation) => annotation.type === CARRIER_MATRIX_ENTRY_ANNOTATION)?.description;
        if (!entryId) return;

        const attachment = result.attachments.find((item) => item.name === CARRIER_MATRIX_RECORD_ATTACHMENT && item.body);
        const errorText = stripAnsiCodes(result.error?.message ?? '');
        let record: CarrierProbeRecord;

        if (attachment?.body) {
            record = JSON.parse(attachment.body.toString('utf8')) as CarrierProbeRecord;
        } else {
            // Timed out or failed before the probe finished (e.g. the API order or the login).
            const firstLine = errorText.split('\n').find((line) => line.trim())?.trim();
            record = fallbackProbeRecord(
                entryId,
                test.title,
                loadCarrierMatrixConfig().mode,
                result.status === 'skipped' ? 'skipped' : 'error',
                firstLine ?? `Test ${result.status}`,
            );
        }

        // On a failure, the carrierDiagnostics fixture prefixes the error with the carrier's own reason.
        const diagnosis = errorText.split('\n').find((line) => line.includes(CARRIER_FAILURE_TAG));
        if (diagnosis && result.status !== 'passed') record.diagnosis = diagnosis.replace(CARRIER_FAILURE_TAG, '').trim();

        this.records.set(test.id, record);
    }

    onEnd(): void {
        if (this.records.size === 0) return;

        const records = [...this.records.values()];
        const mode = records[0].mode;
        const warehouse = process.env.WAREHOUSE_XENVIO?.trim() || 'unknown warehouse';
        const generatedAt = new Date();
        const latestJson = path.join(OUTPUT_DIR, `latest-${mode}.json`);

        try {
            const previous = fs.existsSync(latestJson)
                ? (JSON.parse(fs.readFileSync(latestJson, 'utf8')) as { records: CarrierProbeRecord[] }).records
                : [];
            const summary = summarizeMatrix(records, previous);
            const markdown = renderMatrixMarkdown(summary, { warehouse, mode, generatedAt });
            const json = JSON.stringify({ warehouse, mode, generatedAt: generatedAt.toISOString(), records: summary.records }, null, 2);

            fs.mkdirSync(path.join(OUTPUT_DIR, 'history'), { recursive: true });
            fs.writeFileSync(latestJson, `${json}\n`);
            fs.writeFileSync(path.join(OUTPUT_DIR, `latest-${mode}.md`), markdown);
            fs.writeFileSync(path.join(OUTPUT_DIR, 'history', `${generatedAt.toISOString().replace(/[:.]/g, '-')}-${mode}.json`), `${json}\n`);

            console.log(`\n${markdown}\n📄 Carrier matrix written to ${path.join(OUTPUT_DIR, `latest-${mode}.md`)}`);
        } catch (error) {
            console.warn(`⚠️ Carrier matrix report not written: ${(error as Error).message}`);
        }
    }

    printsToStdio(): boolean {
        return false;
    }
}
