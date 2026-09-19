import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { OrderBuilder, PackageBuilder } from '../test-data';
import { PackageService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';
import { XenvioCarrierRestrictionDialogV2 } from '../page-objects/components/xenvio-carrier-restriction-dialog-v2';

/**
 * ─── Xenvio Multi-Box Carrier Restriction (v2 — PrimeNG) ─────────────────────
 *
 * Test: TC-Xenvio-MultiBox-Restriction-001
 *
 * Validates that the "Action Required" dialog appears when a carrier
 * that does not support multi-box (e.g. ezUSPS) is selected.
 *
 * Flow:
 *  1. Login → Open Shipper View
 *  2. Create Order → Wait for detail (auto-redirect)
 *  3. Create 3 boxes with items (shared workflow)
 *  4. Select a restricted ship code (ezUSPS family)
 *  5. Assert the restriction dialog appears
 *  6. Click Save & Confirm
 */
test.describe('Xenvio Multi-Box Carrier Restriction (v2 PrimeNG)', { tag: ['@e2e', '@carriers'] }, () => {

    test('TC-Xenvio-MultiBox-Restriction-001: Carrier restriction dialog appears for ezUSPS', async ({
        xenvio,
    }) => {
        const packagePlan = PackageBuilder.carrierSafeMultiBox().buildPlan();
        const { recipient, product, item, boxesCount } = OrderBuilder.domestic()
            .withPackagePlan(packagePlan)
            .withBoxes(3)
            .build();

        await AllureHelper.applyTestMetadata({
            displayName: `Multi-Box Carrier Restriction v2 — ezUSPS — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'multibox', 'carrier-restriction', 'ezUSPS', 'carriers', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Configure-Shipment (v2 PrimeNG)',
            story:    'Carrier restriction dialog appears when ezUSPS is selected for multi-box shipment',
        });

        const config = xenvio.config;

        console.log(`\n📦 Carrier Restriction Test (v2 PrimeNG) | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1-2 — Login + Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const session = await xenvio.openSession();
        const popupPage = session.page;

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3 — Create New Order
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient,
            product,
            config.warehouse,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (auto-redirect)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Setup multi-box: create additional boxes + add items
        // ═════════════════════════════════════════════════════════════════════
        await PackageService.setupDomesticMultiBox(popupPage, orderToLabelPage, boxesCount, product, item);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Select a restricted ship code (ezUSPS)
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Select restricted ship code (ezUSPS)', async () => {
            const restriction = orderToLabelPage.carrierRestriction;

            const preferredCodes = [
                process.env.RESTRICTION_SHIP_CODE,
                ...XenvioCarrierRestrictionDialogV2.RESTRICTED_SHIP_CODES,
            ].filter(Boolean) as string[];

            const selectedCode = await restriction.selectShipCode(preferredCodes);
            console.log(`📬 Ship code used: ${selectedCode}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Validate the carrier restriction dialog
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Validate carrier restriction dialog', async () => {
            const restriction = orderToLabelPage.carrierRestriction;

            const dialogAppeared = await restriction.waitForRestrictionDialog(15000);

            if (dialogAppeared) {
                await restriction.assertRestrictionDialogVisible();
                await AllureHelper.attachScreenShot(popupPage);

                console.log('✅ Carrier restriction dialog validated successfully');

                await test.step('8. Click Save & Confirm', async () => {
                    await orderToLabelPage.clickSaveAndConfirm();
                    await AllureHelper.attachScreenShot(popupPage);
                });
            } else {
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
