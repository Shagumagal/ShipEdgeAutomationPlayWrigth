import { test, expect } from '../../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { XenvioWorkflows } from '../../lib/xenvio-workflows';

/**
 * ─── Xenvio Order-to-Label — Individual Flow ──────────────────────────────────
 *
 * Test: TC-Xenvio-O2L-001 — Create one domestic (US) order and get its label.
 *
 * Flow:
 *  1.  Login + Open Shipper View
 *  2.  Select Warehouse & App
 *  3.  Create New Order (random US recipient)
 *  4.  Search shipment & open O2L panel
 *  5.  Add item details to the box
 *  6.  Get Rates
 *  7.  Select rate (Ground Advantage) & Save + Confirm
 *  8.  Get Labels → capture finalPostage, shippingCost, label/doc URLs
 *
 * For creating many orders in a single session use xenvio-order-to-label-batch.spec.ts
 */
test.describe('Xenvio Order-to-Label — Individual', () => {

    test('TC-Xenvio-O2L-001: Create domestic order and get label', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        const recipient = generateUSRecipient();

        // ── Allure metadata ───────────────────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'o2l', 'e2e'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label',
            story:    'Generate label for a single domestic order',
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n📦 Domestic Order`);
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
        // STEP 4 — Search shipment & open O2L panel
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Add item details
        // ═════════════════════════════════════════════════════════════════════
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku:       'TEST-SKU-1',
            country:   'us',
            unitPrice: '1',
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
        await test.step('7. Select and Confirm Rate', async () => {
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Get Labels and capture label results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('8. Get Labels and capture label results', async () => {
            const result = await XenvioWorkflows.getLabelsAndCaptureResult(popupPage, orderToLabelPage, 120000);

            // Soft assertions on captured financial values
            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            // Verify we have at least one label
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
