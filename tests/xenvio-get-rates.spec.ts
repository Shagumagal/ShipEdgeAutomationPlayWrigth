import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { XenvioGetRatesPage } from '../page-objects/xenvio-get-rates-page';
import { generateUSRecipient, StandardPackage } from '../lib/test-data';

/**
 * Xenvio Get Rates Test Suite
 *
 * E2E flow:
 *   1. Create a new order (reusing new-order flow)
 *   2. From shipper-view, open the shipment
 *   3. Fill package dimensions → Get Rates
 *   4. Select a rate → Confirm
 *
 * Controlled by ORDERS_TO_CREATE in .env (default: 1)
 */
test.describe('Xenvio Get Rates Flow', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);

    for (let i = 0; i < ordersToCreate; i++) {
        const orderIndex = i + 1;

        test(`TC-Xenvio-GetRates-${String(orderIndex).padStart(3, '0')}: Create order and get rates #${orderIndex}`, async ({
            page,
            xenvioLoginPage,
            xenvioDashboardPage
        }) => {
            const recipient = generateUSRecipient();

            await AllureHelper.applyTestMetadata({
                displayName: `Get Rates #${orderIndex} — ${recipient.city}, ${recipient.state}`,
                owner: "QA Automation Team",
                tags: ["xenvio", "get-rates", "e2e"],
                severity: "critical",
                epic: "Xenvio",
                feature: "Get Rates",
                story: `Get rates for order #${orderIndex}`
            });

            const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
            const xenvioEmail = process.env.XENVIO_EMAIL!;
            const xenvioPassword = process.env.XENVIO_PASSWORD!;
            const appName = process.env.APP_XENVIO!;
            const warehouseName = process.env.WAREHOUSE_XENVIO!;

            console.log(`\n🎲 Rate request ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

            let popupPage: Page;
            let shipmentNumber: string | null = null;

            // ═══════════════════════════════════════════════════════
            // PHASE 1: Create Order (reusing existing flow)
            // ═══════════════════════════════════════════════════════

            await allure.step('1. Login to Xenvio', async () => {
                await xenvioLoginPage.navigateToLogin(xenvioUrl);
                await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            });

            await allure.step('2. Open Shipper View', async () => {
                popupPage = await xenvioDashboardPage.openShipperView();
                const shipperViewPage = new XenvioShipperViewPage(popupPage);
                await shipperViewPage.selectWarehouse(warehouseName);
                await shipperViewPage.selectApplication(appName);
            });

            await allure.step('3. Create New Order', async () => {
                const newOrderPage = new XenvioNewOrderPage(popupPage);
                await newOrderPage.navigateToNewOrder();
                await newOrderPage.fillRecipientInfo(recipient);
                await newOrderPage.clickContinue();
                await newOrderPage.clickAddProduct();
                await newOrderPage.fillProductDimensions(StandardPackage);
                await newOrderPage.clickSaveProduct();
                await newOrderPage.clickContinue();
                await newOrderPage.selectFulfillmentLocation(warehouseName);

                const details = await newOrderPage.getOrderDetails();
                shipmentNumber = details.shipmentNumber;
                await allure.attachment('Order Number', details.orderNumber ?? 'N/A', 'text/plain');
                await allure.attachment('Shipment Number', shipmentNumber ?? 'N/A', 'text/plain');
                console.log(`📋 Order: ${details.orderNumber} | Shipment: ${shipmentNumber}`);

                await newOrderPage.clickSaveOrder();
                await newOrderPage.waitForOrderCreated(30000);

                // Capture final shipment number from URL
                shipmentNumber = await newOrderPage.getShipmentNumberFromUrl() ?? shipmentNumber;
                console.log(`✅ Order created! Shipment: ${shipmentNumber}`);
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // PHASE 2: Get Rates
            // ═══════════════════════════════════════════════════════

            await allure.step('4. Open Shipment in Shipper View', async () => {
                const getRatesPage = new XenvioGetRatesPage(popupPage);

                if (shipmentNumber) {
                    // The page should already be on shipper-view after order creation
                    // Search for the shipment we just created
                    const shipperView = new XenvioShipperViewPage(popupPage);
                    await shipperView.searchShipment(shipmentNumber);
                    await getRatesPage.clickShipmentRow(shipmentNumber);
                    await getRatesPage.expandShipmentPanel(shipmentNumber);
                }

                await AllureHelper.attachScreenShot(popupPage);
            });

            await allure.step('5. Add Item Details', async () => {
                const getRatesPage = new XenvioGetRatesPage(popupPage);
                
                await getRatesPage.clickAddItem();
                
                await getRatesPage.fillItemDetails({
                    sku: 'TEST-SKU-1',
                    weight: StandardPackage.weight,
                    length: StandardPackage.length,
                    width: StandardPackage.width,
                    height: StandardPackage.height,
                    country: 'us',
                    unitPrice: '1',
                    qty: StandardPackage.qty
                });

                await getRatesPage.clickApplyItem();
                await AllureHelper.attachScreenShot(popupPage);
            });

            await allure.step('6. Save Package & Get Rates', async () => {
                const getRatesPage = new XenvioGetRatesPage(popupPage);
                // Si había algún botón verde adicional para que guarde el paquete general lo presiona, o solo da Get Rates
                await getRatesPage.clickGetRates();
                await AllureHelper.attachScreenShot(popupPage);
            });

            await allure.step('7. Select and Confirm Rate', async () => {
                const getRatesPage = new XenvioGetRatesPage(popupPage);
                
                await getRatesPage.changeItemsPerPageTo50();
                await getRatesPage.selectRateByText('Ground Advantage');
                
                await getRatesPage.clickSaveAndConfirm();
                await AllureHelper.attachScreenShot(popupPage);
            });

            await allure.step('8. Get Labels', async () => {
                const getRatesPage = new XenvioGetRatesPage(popupPage);
                
                await getRatesPage.clickGetLabels();
                
                expect(popupPage.url()).toContain('shipper-view');
                console.log(`✅ Labels successfully generated for order ${orderIndex}/${ordersToCreate}!`);
                await AllureHelper.attachScreenShot(popupPage);
            });
        });
    }

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
