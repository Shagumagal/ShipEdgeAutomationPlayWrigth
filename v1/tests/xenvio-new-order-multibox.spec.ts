import { test } from '../../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from "../../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { XenvioWorkflows } from '../../lib/xenvio-workflows';

/**
 * Xenvio New Order Multi-Box Test Suite
 * Creates 3 boxes with items, gets rates, selects a carrier, and confirms.
 */
test.describe('Xenvio New Order Multi-Box Flow', () => {

    test('TC-Xenvio-NewOrder-MultiBox: Create order with 3 boxes and verify', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient  = generateUSRecipient();
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `New Order Multi-Box (${boxesCount}) — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "new-order", "multibox", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "New-Order",
            story: `Create order with ${boxesCount} boxes, get rates and confirm`
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n📦 Multi-Box Process: ${boxesCount} Boxes | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        // ── Step 1-2: Login and Open Shipper View ─────────────────────────────
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // ── Step 3: Create New Order ──────────────────────────────────────────
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // ── Step 4: Search and Open O2L Panel ────────────────────────────────
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ── Steps 5a-5b: Create additional boxes and add items (shared logic) ─
        await XenvioWorkflows.setupDomesticMultiBox(popupPage, orderToLabelPage, boxesCount, StandardPackage);

        // ── Step 6: Get Rates ─────────────────────────────────────────────────
        await test.step('6. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 7: Select Rate and Save & Confirm ────────────────────────────
        await test.step('7. Select Rate and Save & Confirm', async () => {
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await orderToLabelPage.clickSaveAndConfirm();
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
