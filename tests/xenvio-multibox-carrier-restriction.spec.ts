import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { XenvioCarrierRestrictionDialog } from '../page-objects/components/xenvio-carrier-restriction-dialog';

/**
 * Xenvio Multi-Box Carrier Restriction Test Suite
 *
 * Validates that the "Action Required" dialog appears when a carrier
 * that does not support multi-box (e.g. ezUSPS) is selected.
 *
 * Flow:
 *  1. Login → Shipper View
 *  2. Create Order → O2L panel
 *  3. Create 3 boxes with items
 *  4. Select a restricted ship code (ezUSPS family)
 *  5. Assert the restriction dialog appears
 *  6. Capture screenshot for evidence
 */
test.describe('Xenvio Multi-Box Carrier Restriction', () => {

    test('TC-Xenvio-MultiBox-Restriction-001: Carrier restriction dialog appears for ezUSPS', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient    = generateUSRecipient();
        const boxesCount   = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `Multi-Box Carrier Restriction — ezUSPS — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "multibox", "carrier-restriction", "ezUSPS", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Configure-Shipment",
            story: "Carrier restriction dialog appears when ezUSPS is selected for multi-box shipment"
        });

        const config = {
            url:       process.env.XENVIO_URL      || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n📦 Carrier Restriction Test | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        // ── Step 1 & 2: Login + Shipper View ────────────────────────────
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage, xenvioDashboardPage, config
        );

        // ── Step 3: Create New Order ─────────────────────────────────────
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage, recipient, StandardPackage, config.warehouse
        );

        // ── Step 4: Open O2L Panel ───────────────────────────────────────
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ── Step 5a: Create additional boxes (box 1 already exists) ──────
        await test.step(`5a. Create ${boxesCount - 1} additional Boxes`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, '5', '10', '8', '6');
                await orderToLabelPage.boxForm.clickApplyBox();

                if (i === boxesCount) {
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes created`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 5b: Add items to each box ───────────────────────────────
        await test.step(`5b. Add Items to all ${boxesCount} Boxes`, async () => {
            for (let i = 1; i <= boxesCount; i++) {
                console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);
                await orderToLabelPage.waitForXenvioLoading(15000);
                await orderToLabelPage.boxForm.clickAddItemForBox(i - 1);
                await orderToLabelPage.boxForm.fillItemDetails({
                    sku:       `${i}`,
                    weight:    StandardPackage.weight,
                    length:    StandardPackage.length,
                    width:     StandardPackage.width,
                    height:    StandardPackage.height,
                    country:   'us',
                    unitPrice: '1',
                    qty:       StandardPackage.qty
                });
                await orderToLabelPage.boxForm.clickApplyItem();

                if (i === boxesCount) {
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 6: Select a restricted ship code ────────────────────────
        await test.step('6. Select restricted ship code (ezUSPS)', async () => {
            const restriction = orderToLabelPage.carrierRestriction;

            // Priority list of ship codes to try — first found wins
            const preferredCodes = [
                process.env.RESTRICTION_SHIP_CODE,  // override from .env if set
                ...XenvioCarrierRestrictionDialog.RESTRICTED_SHIP_CODES
            ].filter(Boolean) as string[];

            const selectedCode = await restriction.selectShipCode(preferredCodes);
            console.log(`📬 Ship code used: ${selectedCode}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 7: Validate the carrier restriction dialog ──────────────
        await test.step('7. Validate carrier restriction dialog', async () => {
            const restriction = orderToLabelPage.carrierRestriction;

            const dialogAppeared = await restriction.waitForRestrictionDialog(15000);

            if (dialogAppeared) {
                // Assert the dialog has the expected content and options
                await restriction.assertRestrictionDialogVisible();
                await AllureHelper.attachScreenShot(popupPage);

                console.log('✅ Carrier restriction dialog validated successfully');

                // Dismiss without selecting an action (test stops here)
                await restriction.dismissDialog();
            } else {
                // Dialog did not appear — this could mean:
                //  a) The environment uses a carrier config that supports multibox
                //  b) The ship code was not in the restricted list for this env
                console.warn('⚠️  Restriction dialog did not appear. Logging state for investigation.');
                await AllureHelper.attachScreenShot(popupPage);
                throw new Error(
                    'Expected carrier restriction dialog for ezUSPS multi-box shipment, but it did not appear. ' +
                    'Check that the environment has the ezUSPS carrier configured and the ship code is restricted.'
                );
            }
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
