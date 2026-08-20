import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { InternationalRecipients, StandardInternationalItem } from '../../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * ─── Xenvio – International Order Multi-Box Flow (v2 — PrimeNG) ───────────────
 *
 * Test: TC-Xenvio-Intl-MultiBox-001 — Create a 3-box international order (UK)
 *
 * Flow:
 *  1. Login + Open Shipper View
 *  2. Create Order with international address (10 Downing St, London, GB)
 *  3. Wait for shipment detail (auto-redirect)
 *  4. Setup 3 boxes with international items (shared workflow)
 *  5. Get Rates → Select first rate → Save & Confirm
 *  6. Get Labels → Capture per-box label results (1 label per box)
 */
test.describe('Xenvio Shipper View – International Order Multi-Box (v2 PrimeNG)', () => {

    test('TC-Xenvio-Intl-MultiBox-001: Create 3-box international order (UK) and get labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {

        const recipient  = InternationalRecipients.uk;
        const item       = StandardInternationalItem;
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label International Multi-Box (${boxesCount}) v2 — ${recipient.city}, ${recipient.country}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'international', 'multibox', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label International (v2 PrimeNG)',
            story:    `Generate labels for ${boxesCount}-box international order (${recipient.city}, ${recipient.country})`,
        });

        const config = {
            url:       process.env.XENVIO_URL       || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n🌍 International Multi-Box Order (v2 PrimeNG)`);
        console.log(`   Boxes     : ${boxesCount}`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.country}`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage,
            xenvioDashboardPage,
            config,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3 — Create Order with international address
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage,
            recipient,
            {
                qty:    item.qty,
                length: item.length,
                width:  item.width,
                height: item.height,
                weight: '5',    // Box weight > commodity weight — carrier validation passes
            },
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);
        await AllureHelper.attachScreenShot(popupPage);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Setup multi-box: create additional boxes + add intl items
        // ═════════════════════════════════════════════════════════════════════
        await XenvioWorkflows.setupInternationalMultiBox(
            popupPage,
            orderToLabelPage,
            boxesCount,
            item,
            '5',  // boxWeight
            '6',  // stepPrefix
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('8. Select Rate and Save & Confirm', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(90000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Get Labels and capture per-box results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('9. Get Labels and capture per-box results', async () => {
            const result = await XenvioWorkflows.getLabelsAndCaptureResult(popupPage, orderToLabelPage, 180000);

            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            // Verify we have a label for each box
            expect(result.labelsByBox.length).toBe(boxesCount);
            for (const boxLabel of result.labelsByBox) {
                expect(boxLabel.label, `Box ${boxLabel.boxIndex} must have a valid label URL`).toMatch(/^https?:\/\/.*\.pdf.*/i);
            }

            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
