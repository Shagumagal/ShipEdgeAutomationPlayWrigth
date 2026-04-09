import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { generateUSRecipient, StandardPackage } from '../lib/test-data';

/**
 * Xenvio New Order Test Suite
 *
 * Generates N orders with random US addresses using faker.
 * Controlled by ORDERS_TO_CREATE in .env (default: 1).
 *
 * Usage:
 *   ORDERS_TO_CREATE=1  → 1 order  (quick smoke test)
 *   ORDERS_TO_CREATE=5  → 5 orders (bulk data setup)
 */
test.describe('Xenvio New Order Flow', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);

    for (let i = 0; i < ordersToCreate; i++) {
        const orderIndex = i + 1;

        test(`TC-Xenvio-NewOrder-${String(orderIndex).padStart(3, '0')}: Create order #${orderIndex} with random US address`, async ({
            page,
            xenvioLoginPage,
            xenvioDashboardPage
        }) => {
            // Generate random recipient INSIDE test body (Playwright requires static titles)
            const recipient = generateUSRecipient();

            await AllureHelper.applyTestMetadata({
                displayName: `New Order #${orderIndex} — ${recipient.city}, ${recipient.state}`,
                owner: "QA Automation Team",
                tags: ["xenvio", "new-order", "faker"],
                severity: "critical",
                epic: "Xenvio",
                feature: "New Order",
                story: `Order creation (${orderIndex} of ${ordersToCreate})`
            });

            const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
            const xenvioEmail = process.env.XENVIO_EMAIL!;
            const xenvioPassword = process.env.XENVIO_PASSWORD!;
            const appName = process.env.APP_XENVIO!;
            const warehouseName = process.env.WAREHOUSE_XENVIO!;

            console.log(`\n🎲 Order ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

            let popupPage: Page;

            // ─── Step 1: Login ─────────────────────────────────────
            await allure.step('1. Login to Xenvio', async () => {
                await xenvioLoginPage.navigateToLogin(xenvioUrl);
                await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            });

            // ─── Step 2: Shipper View ──────────────────────────────
            await allure.step('2. Open Shipper View', async () => {
                popupPage = await xenvioDashboardPage.openShipperView();
                const shipperViewPage = new XenvioShipperViewPage(popupPage);
                await shipperViewPage.selectWarehouse(warehouseName);
                await shipperViewPage.selectApplication(appName);
            });

            // ─── Step 3-7: Full Order Flow ─────────────────────────
            await allure.step('3-7. Create New Order (Full Flow)', async () => {
                const newOrderPage = new XenvioNewOrderPage(popupPage);
                const finalShipment = await newOrderPage.createOrderFlow(recipient, StandardPackage, warehouseName);
                
                expect(finalShipment).not.toBeNull();
                console.log(`✅ Order ${orderIndex}/${ordersToCreate} created successfully! Shipment: ${finalShipment}`);
                await AllureHelper.attachScreenShot(popupPage);
                
                if (finalShipment) {
                    await allure.attachment('Final Shipment Number', finalShipment, 'text/plain');
                }
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
