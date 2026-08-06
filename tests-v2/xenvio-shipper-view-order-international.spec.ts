import { test, expect } from '../lib-v2/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from '../lib/test-failure-capture';
import { InternationalRecipients, StandardInternationalItem } from '../lib/test-data';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';

/**
 * ─── Xenvio – International Order Flow (v2 — PrimeNG) ─────────────────────────
 *
 * Test: TC-Xenvio-Intl-001 — Create an international order (UK) and get label
 *
 * Flow:
 *  1. Login + Open Shipper View
 *  2. Create Order with international address (10 Downing St, London, GB)
 *  3. Wait for shipment detail (auto-redirect)
 *  4. Add international item details (SKU, description, harmonization code, country of origin)
 *  5. Get Rates → Select first rate → Save & Confirm
 *  6. Get Labels → Capture finalPostage, shippingCost, label URLs
 */
test.describe('Xenvio Shipper View – International Order (v2 PrimeNG)', () => {

    test('TC-Xenvio-Intl-001: Create international order (UK) and get label', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {

        const recipient = InternationalRecipients.uk;
        const item      = StandardInternationalItem;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label International v2 — ${recipient.city}, ${recipient.country}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'international', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label International (v2 PrimeNG)',
            story:    `Generate label for international order (${recipient.city}, ${recipient.country})`,
        });

        const config = {
            url:       process.env.XENVIO_URL       || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n🌍 International Order (v2 PrimeNG)`);
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
                weight: '5',
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
        // STEP 5 — Add international item details
        // ═════════════════════════════════════════════════════════════════════
        await test.step('5. Add international item details', async () => {
            await orderToLabelPage.boxForm.clickAddItem();
            await AllureHelper.attachScreenShot(popupPage);

            await orderToLabelPage.boxForm.fillInternationalItemDetails({
                sku:               item.sku,
                weight:            item.weight,
                length:            item.length,
                width:             item.width,
                height:            item.height,
                itemDescription:   item.itemDescription,
                harmonizationCode: item.harmonizationCode,
                countryOfOrigin:   item.countryOfOrigin,
                unitPrice:         item.unitPrice,
                qty:               item.qty,
            });

            await orderToLabelPage.boxForm.clickApplyItem();
            await orderToLabelPage.waitForXenvioLoading(30000);
            console.log('✅ International item details applied');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Select Rate and Save & Confirm', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(90000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Get Labels and capture results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('8. Get Labels and capture label results', async () => {
            const result = await XenvioWorkflows.getLabelsAndCaptureResult(popupPage, orderToLabelPage, 120000);

            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            expect(result.labelUrls.length).toBeGreaterThan(0);

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
