import { test, expect } from '../../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { InternationalRecipients, StandardInternationalItem } from '../../lib/test-data';
import { XenvioWorkflows } from '../../lib/xenvio-workflows';

/**
 * ─── Xenvio – International Order Flow ────────────────────────────────────────
 *
 * Test: TC-Xenvio-Intl-001 — Create an international order (UK) and get label
 *
 * Flow:
 *  1.  Login + Open Shipper View
 *  2.  Select Warehouse & App
 *  3.  Navigate to New Order
 *  4.  Fill international recipient info (10 Downing St, London, GB)
 *  5.  Continue → Boxes tab
 *  6.  Add Product (box dimensions)
 *  7.  Fill international item details:
 *        – SKU, Weight, Length, Width, Height
 *        – Item Description
 *        – Harmonization Code
 *        – Country of Origin
 *  8.  Continue → Order Details tab
 *  9.  Select fulfillment warehouse → Save Order
 * 10.  Search for the created shipment
 * 11.  Open O2L panel for that shipment
 * 12.  Get Rates
 * 13.  Select Rate → Save & Confirm
 * 14.  Get Labels (wait for Void Label to appear)
 * 15.  Extra 5 s wait → screenshot of final label view
 * 16.  Capture & print task label result (finalPostage, shippingCost, label/doc URLs)
 */
test.describe('Xenvio Shipper View – International Order', () => {

    test('TC-Xenvio-Intl-001: Create international order (UK) and get label', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {

        const recipient = InternationalRecipients.uk;
        const item      = StandardInternationalItem;

        // ── Allure metadata ──────────────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label International — ${recipient.city}, ${recipient.country}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'international', 'e2e'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label International',
            story:    `Generate label for international order (${recipient.city}, ${recipient.country})`,
        });

        const config = {
            url:       process.env.XENVIO_URL       || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n🌍 International Order`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.country}`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View (shared workflow)
        // ═══════════════════════════════════════════════════════════════
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage,
            xenvioDashboardPage,
            config,
        );

        // ═══════════════════════════════════════════════════════════════
        // STEP 3-9 — Create Order with international address
        //
        // We use XenvioWorkflows.createStandardOrder which internally calls
        // XenvioNewOrderPage.createOrderFlow(). That flow already handles
        // country selection via the autocomplete, so passing country='GB'
        // will pick Great Britain from the dropdown automatically.
        // ═══════════════════════════════════════════════════════════════
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage,
            // RecipientData (country='GB' triggers international address form)
            recipient,
            // Standard box dimensions (reused from domestic flow)
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

        // ═══════════════════════════════════════════════════════════════
        // STEP 10-11 — Search shipment & open O2L panel (shared workflow)
        // ═══════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ═══════════════════════════════════════════════════════════════
        // STEP 12 — Fill international item details
        //           (SKU + box dims + Item Description + Harmonization Code
        //            + Country of Origin + Unit Price + Qty)
        // ═══════════════════════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════════════════════
        // STEP 13 — Get Rates
        // ═══════════════════════════════════════════════════════════════
        await test.step('6. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 14 — Select Rate & Save & Confirm
        // ═══════════════════════════════════════════════════════════════
        await test.step('7. Select Rate and Save & Confirm', async () => {
            // For international shipments DHL/FedEx International are common;
            // fallback selects the first available rate automatically
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('International', 90000);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 15-16 — Get Labels and capture label results
        // ═══════════════════════════════════════════════════════════════
        await test.step('8. Get Labels and capture label results', async () => {
            const result = await XenvioWorkflows.getLabelsAndCaptureResult(popupPage, orderToLabelPage, 120000);

            // Soft assertions on captured financial values
            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            // Verify we have a label
            expect(result.labelUrls.length).toBeGreaterThan(0);

            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    // ─── After-each error capture ────────────────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
