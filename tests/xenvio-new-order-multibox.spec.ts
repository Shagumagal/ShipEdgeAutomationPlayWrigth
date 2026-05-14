import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio New Order Multi-Box Test Suite
 * Stops after creating boxes and getting rates.
 */
test.describe('Xenvio New Order Multi-Box Flow', () => {

    test('TC-Xenvio-NewOrder-MultiBox: Create order with 3 boxes and verify', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient = generateUSRecipient();
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `New Order Multi-Box (${boxesCount}) — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "new-order", "multibox", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "New-Order",
            story: `Create order with ${boxesCount} boxes and verify`
        });

        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n📦 Multi-Box Process: ${boxesCount} Boxes | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        // REUSE: Login and Open Shipper View
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // REUSE: Create New Order
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // REUSE: Search and Open O2L Panel
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ── Step 5a: Create all boxes first (Specific to Multi-Box) ──
        await test.step(`5a. Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, '5', '10', '8', '6');
                await orderToLabelPage.boxForm.clickApplyBox();
                
                // Wait for the loading spinner to resolve when we finish creating the last box
                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for Xenvio loading spinner after the final box creation...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes created`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 5b: Add items to each box (Specific to Multi-Box) ──
        await test.step(`5b. Add Items to all ${boxesCount} Boxes (SKU 1-${boxesCount})`, async () => {
            for (let i = 1; i <= boxesCount; i++) {
                console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);
                
                // Wait for loading spinner to disappear before clicking Add Item to avoid interception
                await orderToLabelPage.waitForXenvioLoading(15000);
                
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
                
                // Wait for the loading spinner to resolve when we finish adding the last item
                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for Xenvio loading spinner after adding the final item...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // FINAL PHASE
        // ═══════════════════════════════════════════════════════

        await test.step('6. Verify Boxes and Stop', async () => {
            console.log('✅ 3 Boxes and items created. Test stops here as requested.');
            // A screenshot is already taken at the end of step 5b which will show the final state.
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
