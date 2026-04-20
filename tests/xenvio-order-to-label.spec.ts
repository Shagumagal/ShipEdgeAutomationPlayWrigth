import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio Order-to-Label Test Suite (Refactored for Reusability)
 */
test.describe('Xenvio Order-to-Label Flow', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);

    for (let i = 0; i < ordersToCreate; i++) {
        const orderIndex = i + 1;

        test(`TC-Xenvio-O2L-${String(orderIndex).padStart(3, '0')}: Create order and get label #${orderIndex}`, async ({
            xenvioLoginPage,
            xenvioDashboardPage
        }) => {
            const recipient = generateUSRecipient();

            await AllureHelper.applyTestMetadata({
                displayName: `Order-to-Label #${orderIndex} — ${recipient.city}, ${recipient.state}`,
                owner: "QA Automation Team",
                tags: ["xenvio", "order-to-label", "o2l", "e2e"],
                severity: "critical",
                epic: "Xenvio",
                feature: "Order-to-Label",
                story: `Generate label for order #${orderIndex}`
            });

            const config = {
                url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
                email: process.env.XENVIO_EMAIL!,
                pass: process.env.XENVIO_PASSWORD!,
                app: process.env.APP_XENVIO!,
                warehouse: process.env.WAREHOUSE_XENVIO!
            };

            console.log(`\n🎲 Rate request ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

            // REUSE: Login and Open Shipper View
            const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

            // REUSE: Create New Order
            const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

            // REUSE: Search and Open O2L Panel
            const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

            // REUSE: Add Item Details
            await XenvioWorkflows.addItemDetails(orderToLabelPage, {
                ...StandardPackage,
                sku: 'TEST-SKU-1',
                country: 'us',
                unitPrice: '1'
            });

            // ═══════════════════════════════════════════════════════
            // FLOW CONTINUATION (Specific to Labeling)
            // ═══════════════════════════════════════════════════════

            await test.step('6. Save Package & Get Rates', async () => {
                await orderToLabelPage.clickGetRates();
                await AllureHelper.attachScreenShot(popupPage);
            });

            await test.step('7. Select and Confirm Rate', async () => {
                await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
                await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
                await orderToLabelPage.clickSaveAndConfirm();
                await AllureHelper.attachScreenShot(popupPage);
            });

            await test.step('8. Get Labels', async () => {
                await orderToLabelPage.clickGetLabels();
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
