import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';

/**
 * Xenvio New Order Test Suite
 * 
 * E2E flow: Login Xenvio → Shipper View → Create New Order → Verify Shipment
 * Requires valid Xenvio credentials in .env
 */
test.describe('Xenvio New Order Flow', () => {

    test('TC-Xenvio-NewOrder-001: Create a new order from Shipper View', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Create New Order in Xenvio",
            owner: "QA Automation Team",
            tags: ["xenvio", "new-order", "e2e", "smoke"],
            severity: "critical",
            epic: "Xenvio",
            feature: "New Order",
            story: "Create order from Shipper View and verify shipment"
        });

        // ─── Environment Variables ───
        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL;
        const xenvioPassword = process.env.XENVIO_PASSWORD;
        const appName = process.env.APP_XENVIO;
        const warehouseName = process.env.WAREHOUSE_XENVIO;

        if (!xenvioEmail || !xenvioPassword || !appName || !warehouseName) {
            throw new Error('XENVIO_EMAIL, XENVIO_PASSWORD, APP_XENVIO and WAREHOUSE_XENVIO must be set in .env');
        }

        // ─────────────────────────────────────────────────────────
        // STEP 1: Login to Xenvio
        // ─────────────────────────────────────────────────────────
        await allure.step('1. Navigate to Xenvio Login', async () => {
            console.log(`Navegando a: ${xenvioUrl}`);
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
        });

        await allure.step('2. Perform Login in Xenvio', async () => {
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            console.log('✅ Login exitoso en Xenvio');
        });

        // ─────────────────────────────────────────────────────────
        // STEP 2: Open Shipper View (new tab)
        // ─────────────────────────────────────────────────────────
        let popupPage: Page;

        await allure.step('3. Open Shipper View (new tab)', async () => {
            popupPage = await xenvioDashboardPage.openShipperView();
            console.log(`Pestaña nueva abierta. URL: ${popupPage.url()}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ─────────────────────────────────────────────────────────
        // STEP 3: Configure Warehouse & Application
        // ─────────────────────────────────────────────────────────
        await allure.step('4. Select Warehouse and Application', async () => {
            const shipperViewPage = new XenvioShipperViewPage(popupPage);

            await shipperViewPage.selectWarehouse(warehouseName);
            await shipperViewPage.selectApplication(appName);

            console.log('✅ Warehouse and Application selected');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ─────────────────────────────────────────────────────────
        // STEP 4: Create New Order
        // ─────────────────────────────────────────────────────────
        let shipmentNumber: string | null = null;

        await allure.step('5. Navigate to New Order page', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            await newOrderPage.navigateToNewOrder();
            console.log('✅ Navigated to New Order form');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('6. Fill Recipient Information', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);

            await newOrderPage.fillRecipientInfo({
                name: 'QA Test Recipient',
                company: 'qa20',
                email: 'qatest@test.com',
                address1: '100 NW 1st Ave',
                state: 'FL',
                city: 'Miami',
                zip: '33101',
                country: 'us'
            });

            console.log('✅ Recipient info filled');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('7. Continue to Product Step', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            await newOrderPage.clickContinue();
            console.log('✅ Moved to product step');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('8. Add Product with Dimensions', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);

            await newOrderPage.clickAddProduct();
            await newOrderPage.fillProductDimensions({
                qty: '1',
                length: '1',
                width: '1',
                height: '1',
                weight: '1'
            });
            await newOrderPage.clickSaveProduct();

            console.log('✅ Product added and saved');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('9. Navigate to Order Details tab', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            await newOrderPage.clickContinue();
            console.log('✅ Moved to Order details tab');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('10. Select Fulfillment Location', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            await newOrderPage.selectFulfillmentLocation(warehouseName);
            console.log('✅ Fulfillment location selected');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('11. Save Order', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            await newOrderPage.clickSaveOrder();
            console.log('✅ Order saved');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ─────────────────────────────────────────────────────────
        // STEP 5: Verify Order Created
        // ─────────────────────────────────────────────────────────
        await allure.step('12. Verify Order Created and Capture Shipment Number', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);

            // Wait for redirect to shipper-view with shipment_number
            await newOrderPage.waitForOrderCreated(30000);

            // Capture the shipment number from URL
            shipmentNumber = await newOrderPage.getShipmentNumberFromUrl();

            if (shipmentNumber) {
                console.log(`🎉 Order created successfully! Shipment: ${shipmentNumber}`);
                await allure.attachment('Shipment Number', shipmentNumber, 'text/plain');
            } else {
                console.log('⚠️ Order created but could not capture shipment number');
            }

            // Verify URL contains shipper-view
            expect(popupPage.url()).toContain('shipper-view');

            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    // After hook for capturing test failure artifacts
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
