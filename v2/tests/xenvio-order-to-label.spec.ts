import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * ─── Xenvio Order-to-Label — Individual Flow (v2 — PrimeNG) ──────────────────
 *
 * Test: TC-Xenvio-O2L-001 — Create one domestic (US) order and get its label.
 *
 * Same business flow as the legacy test, but using v2 page objects with:
 *   - PrimeNG p-select for warehouse/app selection
 *   - DynamicDialog modals for Add Box / Add Item
 *   - p-button for action bar (GET RATES, SAVE & CONFIRM, GET LABELS)
 *   - p-accordion for shipment panel
 *
 * Flow:
 *  1.  Login + Open Shipper View
 *  2.  Select Warehouse & App (via p-select)
 *  3.  Create New Order (random US recipient)
 *  4.  Search shipment & open O2L panel
 *  5.  Add item details to the box (via DynamicDialog modal)
 *  6.  Get Rates (via p-button)
 *  7.  Select rate (Ground Advantage) & Save + Confirm
 *  8.  Get Labels → capture finalPostage, shippingCost, label/doc URLs
 */
test.describe('Xenvio Order-to-Label — Individual (v2 PrimeNG)', () => {

    test('TC-Xenvio-O2L-001: Create domestic order and get label', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        const recipient = generateUSRecipient();

        // ── Allure metadata ───────────────────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'o2l', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label (v2 PrimeNG)',
            story:    'Generate label for a single domestic order',
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n📦 Domestic Order (v2 PrimeNG)`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);
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
            StandardPackage,
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects after save)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Add item details (via DynamicDialog modal)
        // ═════════════════════════════════════════════════════════════════════
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku:       'TEST-SKU-1',
            country:   'us',
            unitPrice: '1',
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Get Rates (via p-button)
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Select and Confirm Rate', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(60000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Get Labels and capture label results
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

            console.log(`✅ Label successfully generated for shipment ${shipmentNumber}!`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    // ─── After-each error capture ─────────────────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
