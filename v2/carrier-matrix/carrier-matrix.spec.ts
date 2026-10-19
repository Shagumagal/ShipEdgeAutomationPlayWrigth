import type { TestInfo } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../evidence/allure-helper';
import { OrderBuilder } from '../test-data';
import { ShipmentNavigationService } from '../services';
import { loadCarrierMatrixConfig, resolveCarrierMatrixEntries } from '../config/carrier-matrix-config';
import {
    CARRIER_MATRIX_ENTRY_ANNOTATION,
    CARRIER_MATRIX_RECORD_ATTACHMENT,
    entrySkipReason,
    entryTitle,
    newProbeRecord,
    type CarrierProbeRecord,
} from '../domain/carriers/carrier-matrix';
import { probeCarrierEntry } from '../workflows/carrier-probe-workflow';

/**
 * ─── Carrier matrix (manual, not part of any suite) ────────────────────────────
 *
 * One test per entry of the matrix file (written by discover-carriers.spec.ts) or of
 * CARRIER_MATRIX_SHIP_CODES. Each test creates an open order through API v3, opens it, selects
 * the entry in Configure Shipment and checks that its ship method works:
 *
 *   CARRIER_MATRIX_MODE=rates (default)  the method gets a rate — nothing is bought
 *   CARRIER_MATRIX_MODE=label            the label is bought and voided
 *
 * A test passes only when the entry works. The carrier-matrix reporter prints the whole
 * matrix at the end and writes carrier-matrix-report/. In Allure: Suites → Carrier Matrix →
 * carrier → ship method.
 *
 *   npm run carriers:matrix
 *   npm run carriers:matrix -- -g "FedEx"      # only the entries whose title matches
 *   npm run carriers:matrix:labels
 *
 * See docs/19-carrier-matrix.md.
 */
const matrixConfig = loadCarrierMatrixConfig();
const { entries, source, problem } = resolveCarrierMatrixEntries(matrixConfig);

async function attachRecord(testInfo: TestInfo, record: CarrierProbeRecord): Promise<void> {
    await testInfo.attach(CARRIER_MATRIX_RECORD_ATTACHMENT, {
        body: JSON.stringify(record, null, 2),
        contentType: 'application/json',
    });
}

test.describe(`Carrier matrix (${matrixConfig.mode} mode)`, { tag: ['@carrier-matrix'] }, () => {

    if (problem) {
        test('Carrier matrix entries are available', () => {
            throw new Error(problem);
        });
    }

    for (const entry of entries) {
        const title = entryTitle(entry);

        test(title, {
            annotation: { type: CARRIER_MATRIX_ENTRY_ANNOTATION, description: entry.id },
        }, async ({ xenvio, apiOrders }, testInfo) => {
            const { mode, allowProduction } = matrixConfig;

            await AllureHelper.applyTestMetadata({
                displayName: `Carrier matrix (${mode}) — ${title}`,
                owner: 'QA Automation Team',
                tags: ['xenvio', 'carrier-matrix', 'configure-shipment', mode],
                severity: 'normal',
                epic: 'Xenvio',
                feature: 'Carrier matrix',
                story: `${mode === 'label' ? 'Label' : 'Rate'} for a carrier ship method`,
                parentSuite: 'Carrier Matrix',
                suite: entry.carrier || entry.shipCode || 'Unknown carrier',
                subSuite: entry.method || entry.shipCode || 'Unknown method',
            });
            await AllureHelper.addRunParameters({ 'Matrix source': source, Mode: mode });

            const skipReason = entrySkipReason(entry, mode, allowProduction);
            if (skipReason) {
                await attachRecord(testInfo, { ...newProbeRecord(entry, mode), status: 'skipped', message: skipReason });
                test.skip(true, skipReason);
            }

            const order = await apiOrders.createOpenOrder(OrderBuilder.domestic().build(), xenvio.config.warehouse);
            const session = await xenvio.openSession();
            const orderPage = await ShipmentNavigationService.openByUrl(session.page, {
                shipmentNumber: order.shipmentNumber,
                warehouseId: order.warehouseId,
                appId: 0,
            });

            const probed = await probeCarrierEntry(session.page, orderPage, entry, { mode, allowProduction });
            const record: CarrierProbeRecord = {
                ...probed,
                shipmentNumber: order.shipmentNumber,
                shipmentLink: probed.shipmentLink ?? session.page.url(),
            };
            await attachRecord(testInfo, record);
            await AllureHelper.addRunParameters({
                Status: record.status,
                'Ship code': record.shipCode,
                Carrier: record.carrier,
                'Ship method': record.method,
                Rate: record.rate,
            });

            if (record.status === 'skipped') test.skip(true, record.message);
            expect(record.status, `${title}: ${record.message}`).toBe('works');
        });
    }
});
