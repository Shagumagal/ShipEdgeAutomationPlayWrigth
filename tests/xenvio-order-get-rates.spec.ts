import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

test.describe('Xenvio Order Get Rates Process', () => {

    test('TC-Xenvio-GR-001: Create order and request rates', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: "Order to Get Rates Process",
            owner: "QA Automation Team",
            tags: ["xenvio", "get-rates", "smoke"],
            severity: "normal",
            epic: "Xenvio",
            feature: "Rates Engine",
            story: "Verify rates appear in modal"
        });

        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n🎲 Starting Rate Verification for: ${recipient.name} | ${recipient.zip}`);

        // REUSE: Login and Open Shipper View
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // REUSE: Create New Order
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // REUSE: Search and Open O2L Panel
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // REUSE: Add Item Details
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku: 'TEST-SKU-GET-RATES',
            country: 'us',
            unitPrice: '1'
        });

        // Step 11: Get Rates & Select Preferred
        await orderToLabelPage.clickGetRates();
        await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');

        // Step 12: Save & Confirm (Final step for this test)
        await orderToLabelPage.clickSaveAndConfirm();

        console.log('✅ Workflow "Order to Get Rates" completed successfully');
        await AllureHelper.attachScreenShot(popupPage);
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
