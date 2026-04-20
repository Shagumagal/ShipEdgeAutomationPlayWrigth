import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio New Order Test Suite (Refactored for Reusability)
 */
test.describe('Xenvio New Order Flow', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);

    for (let i = 0; i < ordersToCreate; i++) {
        const orderIndex = i + 1;

        test(`TC-Xenvio-NewOrder-${String(orderIndex).padStart(3, '0')}: Create order #${orderIndex} with random US address`, async ({
            xenvioLoginPage,
            xenvioDashboardPage
        }) => {
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

            const config = {
                url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
                email: process.env.XENVIO_EMAIL!,
                pass: process.env.XENVIO_PASSWORD!,
                app: process.env.APP_XENVIO!,
                warehouse: process.env.WAREHOUSE_XENVIO!
            };

            console.log(`\n🎲 Order ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

            // REUSE: Login and Open Shipper View
            const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

            // REUSE: Create New Order
            const finalShipment = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);
            
            expect(finalShipment).not.toBeNull();
            console.log(`✅ Order ${orderIndex}/${ordersToCreate} created successfully! Shipment: ${finalShipment}`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
