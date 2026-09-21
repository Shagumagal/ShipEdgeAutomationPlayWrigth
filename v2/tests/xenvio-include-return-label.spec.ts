import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { DefaultReturnLabel } from '../../lib/test-data';
import { LabelEvidenceService } from '../evidence';
import { OrderBuilder } from '../test-data';
import {
    describeReturnLabelError,
    parseReturnLabelResponse,
} from '../parsers/return-label-parser';
import { logReturnLabelSummary } from '../parsers/shipment-result-logger';

/**
 * ─── Xenvio Include Return Label Flow (v2 — PrimeNG) ─────────────────────────
 *
 * Test: TC-Xenvio-RL-001 — Create order with return label and generate labels.
 *
 * Flow:
 *  1. Login → Open Shipper View
 *  2. Create Order → Wait for detail
 *  3. Add Item Details
 *  4. Configure Return Label (via Configure Shipment panel)
 *  5. GET RATES → Select first rate → SAVE & CONFIRM
 *  6. GET LABELS → capture main + return label (v2/parsers/return-label-workflow.ts)
 *     → Validate both labels
 */
test.describe('Xenvio Include Return Label (v2 PrimeNG)', { tag: ['@e2e', '@labels', '@shipment-config'] }, () => {

    test('TC-Xenvio-RL-001: Create order with return label and generate labels', async ({
        xenvio,
    }) => {
        const { recipient, product, item } = OrderBuilder.domestic().build();

        await AllureHelper.applyTestMetadata({
            displayName: `Include Return Label v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'return-label', 'configure-shipment', 'labels', 'shipment-config', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Return Label (v2 PrimeNG)',
            story:    'Configure and generate label with return label included',
        });

        const config = xenvio.config;

        console.log(`\n📦 Return Label Test (v2 PrimeNG): ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const session = await xenvio.openSession();
        const popupPage = session.page;

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3 — Create New Order
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await session.orders.createStandardOrder(
            recipient,
            product,
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await session.shipments.waitForDetailAfterCreation(shipmentNumber);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Add Item Details
        // ═════════════════════════════════════════════════════════════════════
        await session.packages.addItemDetails(orderToLabelPage, {
            ...item,
            sku: 'TEST-SKU-RETURN-LABEL',
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Configure Return Label
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Configure Return Label', async () => {
            await session.configuration.configureReturnLabel(orderToLabelPage, DefaultReturnLabel);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Save Package & Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('8. Select and Confirm Rate', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(60000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await orderToLabelPage.waitForXenvioLoading(60000);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 9 — Get Labels & Validate Return Label API Response
        // ═════════════════════════════════════════════════════════════════════
        await test.step('9. Get Labels & Validate Return Label API Response', async () => {
            // Captures main + return label; retries once with "GET RETURN LABEL" only on error 1008.
            const capture = await session.labels.generateWithReturnLabel(orderToLabelPage);
            const result = parseReturnLabelResponse(capture.responseBody);
            const apiError = capture.returnLabelError
                ? ` — return_label API error: ${describeReturnLabelError(capture.returnLabelError)}`
                : '';

            console.log(`📄 Forward Label : ${result.forwardLabelUrl}`);
            console.log(`📄 Return Label  : ${result.returnLabelUrl}`);

            // ── Validations ──
            expect(
                result.returnLabelUrl,
                `❌ returnLabel must be present in the task_executor response${apiError}`
            ).toBeTruthy();

            expect(
                result.returnLabelUrl,
                '❌ returnLabel must point to a .pdf file'
            ).toMatch(/\.pdf(\?|$|--)/i);

            expect(
                result.forwardLabelUrl,
                '❌ label (forward) must be present in the task_executor response'
            ).toBeTruthy();

            expect(
                result.shipmentNumber,
                '❌ task_executor response must belong to the shipment created by this test'
            ).toBe(shipmentNumber);

            expect(
                result.trackingNumber,
                '❌ generated label must include a tracking number'
            ).toBeTruthy();

            expect(
                result.shipmentState,
                '❌ Shipment must be in "shipped" state after generating labels'
            ).toBe('shipped');

            expect(
                result.isAutoReturnLabel,
                '❌ isAutoReturnLabel must be true when return label is configured'
            ).toBe(true);

            // ── Evidence (validated PDFs + JSON + screenshots) ──
            const labelEvidence = LabelEvidenceService.fromReturnLabelResult(shipmentNumber, result, capture);
            // Closes the evidence with the return label success toast instead of the VOID button.
            await LabelEvidenceService.capture(popupPage, orderToLabelPage, labelEvidence, {
                uiProof: capture.successToastScreenshot
                    ? { name: 'UI proof - Return label created successfully', image: capture.successToastScreenshot }
                    : 'none',
            });

            logReturnLabelSummary(labelEvidence);
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
