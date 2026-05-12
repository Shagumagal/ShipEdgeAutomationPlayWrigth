import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage, DefaultReturnLabel } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio Include Return Label Test Suite
 *
 * End-to-end test that validates the "Include Return Label" flow:
 *   1. Login → 2. Create Order → 3. Search & Open Shipment
 *   4. Add Item Details → 5. Configure Return Label (NEW)
 *   6. GET RATES → 7. Select Rate & SAVE & CONFIRM → 8. GET LABELS
 *
 * Reuses all shared workflows from XenvioWorkflows.
 * The Return Label configuration uses XenvioConfigureShipmentPanel
 * (accessible via orderToLabelPage.configPanel).
 */
test.describe('Xenvio Include Return Label Flow', () => {

    test('TC-Xenvio-RL-001: Create order with return label and generate labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: `Include Return Label — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "return-label", "configure-shipment", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Return Label",
            story: "Configure and generate label with return label included",
            parentSuite: "Xenvio Shipment Suite",
            suite: "Return Label Tests",
            subSuite: "Include Return Label"
        });

        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n📦 Return Label Test: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

        // ═══════════════════════════════════════════════════════
        // REUSABLE STEPS (from XenvioWorkflows)
        // ═══════════════════════════════════════════════════════

        // Step 1-2: Login and Open Shipper View
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // Step 3: Create New Order
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // Step 4: Search and Open O2L Panel
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // Step 5: Add Item Details
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku: 'TEST-SKU-RETURN-LABEL',
            country: 'us',
            unitPrice: '1'
        });

        // ═══════════════════════════════════════════════════════
        // NEW: RETURN LABEL CONFIGURATION
        // ═══════════════════════════════════════════════════════

        await test.step('6. Configure Return Label', async () => {
            await XenvioWorkflows.configureReturnLabel(orderToLabelPage, DefaultReturnLabel);
        });

        // ═══════════════════════════════════════════════════════
        // FLOW CONTINUATION (Same as O2L)
        // ═══════════════════════════════════════════════════════

        await test.step('7. Save Package & Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        await test.step('8. Select and Confirm Rate', async () => {
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await orderToLabelPage.clickSaveAndConfirm();
            // Wait for loading to finish after save & confirm
            await orderToLabelPage.waitForXenvioLoading(60000);
            await AllureHelper.attachScreenShot(popupPage);
        });

        await test.step('9. Get Labels', async () => {
            await orderToLabelPage.clickGetLabels(90000);

            console.log(`✅ Labels (with return label) successfully generated!`);
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
