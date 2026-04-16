import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { generateUSRecipient, StandardPackage } from '../lib/test-data';

/**
 * Xenvio Order-to-Label Multi-Box Test Suite
 *
 * E2E flow:
 *   1. Create a new order with 10 Boxes
 *   2. From shipper-view, open the shipment
 *   3. Add 10 Item details (SKU 1 to 10)
 *   4. Select a rate → Confirm
 *   5. Get Labels
 */
test.describe('Xenvio Order-to-Label Multi-Box Flow', () => {

    test('TC-Xenvio-O2L-MultiBox: Create order with 10 boxes and get labels', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient = generateUSRecipient();
        const boxesCount = 10;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label Multi-Box (10) — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "order-to-label", "o2l", "multibox", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Order-to-Label",
            story: `Generate label for multi-box order (10 boxes)`
        });

        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL!;
        const xenvioPassword = process.env.XENVIO_PASSWORD!;
        const appName = process.env.APP_XENVIO!;
        const warehouseName = process.env.WAREHOUSE_XENVIO!;

        console.log(`\n📦 Multi-Box Process: 10 Boxes | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        let popupPage: Page;
        let shipmentNumber: string | null = null;

        // ═══════════════════════════════════════════════════════
        // PHASE 1: Create Order (10 Boxes)
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

        await allure.step(`3. Create New Order with 1 Box`, async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            shipmentNumber = await newOrderPage.createOrderFlow(recipient, StandardPackage, warehouseName);
            
            expect(shipmentNumber).not.toBeNull();
            console.log(`✅ Initial order created! Shipment: ${shipmentNumber}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 2: Order-to-Label (10 Items)
        // ═══════════════════════════════════════════════════════

        await allure.step('4. Open Shipment in Shipper View', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);

            if (shipmentNumber) {
                const shipperView = new XenvioShipperViewPage(popupPage);
                await shipperView.searchShipment(shipmentNumber);
                await orderToLabelPage.clickShipmentRow(shipmentNumber);
                await orderToLabelPage.expandShipmentPanel(shipmentNumber);
            }

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 5a: Create all boxes first ──
        await allure.step(`5a. Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`, async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);

            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, '5', '10', '8', '6');
                await orderToLabelPage.boxForm.clickApplyBox();
            }
            console.log(`✅ All ${boxesCount} boxes created`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 5b: Add items to each box ──
        await allure.step(`5b. Add Items to all ${boxesCount} Boxes (SKU 1-${boxesCount})`, async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);

            for (let i = 1; i <= boxesCount; i++) {
                console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);

                await orderToLabelPage.boxForm.clickAddItemForBox(i - 1);

                await orderToLabelPage.boxForm.fillItemDetails({
                    sku: `${i}`,
                    weight: StandardPackage.weight,
                    length: StandardPackage.length,
                    width: StandardPackage.width,
                    height: StandardPackage.height,
                    country: 'us',
                    unitPrice: '1',
                    qty: StandardPackage.qty
                });

                await orderToLabelPage.boxForm.clickApplyItem();
            }
            console.log(`✅ All ${boxesCount} items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('6. Get Rates', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('7. Select and Confirm Rate', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);

            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            // Fallback selection if Ground Advantage is not available
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');

            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('8. Get Labels', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.clickGetLabels();
            
            expect(popupPage.url()).toContain('shipper-view');
            console.log(`✅ Multi-box labels successfully generated!`);
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
