import { test, expect } from '../lib-v2/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from '../lib/test-failure-capture';
import { generateUSRecipient, SmallPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';

/**
 * ─── Xenvio Order-to-Label — Multi-Box Flow (v2 — PrimeNG) ───────────────────
 *
 * Test: TC-Xenvio-O2L-MultiBox — Create order with 3 boxes and get labels.
 *
 * Flow:
 *  1. Login + Open Shipper View
 *  2. Create New Order (random US recipient)
 *  3. Wait for shipment detail (auto-redirect)
 *  4. Setup 3 boxes with domestic items (shared workflow)
 *  5. Get Rates → Select first rate → Save & Confirm
 *  6. Get Labels → Capture per-box label results
 */
test.describe('Xenvio Order-to-Label Multi-Box (v2 PrimeNG)', () => {

    test('TC-Xenvio-O2L-MultiBox: Create order with 3 boxes and get labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        const recipient  = generateUSRecipient();
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label Multi-Box (${boxesCount}) v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'o2l', 'multibox', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label (v2 PrimeNG)',
            story:    `Generate label for multi-box order (${boxesCount} boxes)`,
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n📦 Multi-Box Process (v2 PrimeNG): ${boxesCount} Boxes`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.state}`);
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
        // STEP 3 — Create New Order
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage,
            recipient,
            SmallPackage,
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Setup multi-box: create additional boxes + add items
        // ═════════════════════════════════════════════════════════════════════
        await XenvioWorkflows.setupDomesticMultiBox(popupPage, orderToLabelPage, boxesCount, SmallPackage);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Configure Ship Code (EUSEM for multibox compatibility)
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Configure Ship Code: EUSEM', async () => {
            await XenvioWorkflows.configureShipCode(orderToLabelPage, 'EUSEM');
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Get Rates', async () => {
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
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 9 — Get Labels and capture results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('9. Get Labels and capture label results', async () => {
            const result = await XenvioWorkflows.getLabelsAndCaptureResult(popupPage, orderToLabelPage, 120000);

            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            expect(result.labelUrls.length).toBeGreaterThan(0);

            console.log(`✅ Multi-box labels successfully generated! (${result.labelUrls.length} label(s))`);
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
