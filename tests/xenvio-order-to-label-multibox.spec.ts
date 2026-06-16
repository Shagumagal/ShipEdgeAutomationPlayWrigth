import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio Order-to-Label Multi-Box Test Suite
 */
test.describe('Xenvio Order-to-Label Multi-Box Flow', () => {

    test('TC-Xenvio-O2L-MultiBox: Create order with 3 boxes and get labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient  = generateUSRecipient();
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label Multi-Box (${boxesCount}) — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "order-to-label", "o2l", "multibox", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Order-to-Label",
            story: `Generate label for multi-box order (${boxesCount} boxes)`
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
        await test.step('7. Select and Confirm Rate', async () => {
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 8: Get Labels ────────────────────────────────────────────────
        await test.step('8. Get Labels', async () => {
            // Generating labels for multiple boxes takes longer — use an extended timeout
            await orderToLabelPage.clickGetLabels(90000);
            
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
