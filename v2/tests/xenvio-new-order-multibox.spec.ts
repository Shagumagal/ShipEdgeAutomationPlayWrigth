import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { OrderBuilder, PackageBuilder } from '../test-data';
import { PackageService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio New Order Multi-Box (v2 — PrimeNG) ─────────────────────────────
 *
 * Creates a domestic order with 3 boxes, adds items to each box,
 * gets rates, selects a rate, and confirms. Does NOT generate labels.
 */
test.describe('Xenvio New Order Multi-Box (v2 PrimeNG)', { tag: ['@e2e', '@orders'] }, () => {

    test('TC-Xenvio-NewOrder-MultiBox: Create order with 3 boxes and verify', async ({
        xenvio,
    }) => {
        const packagePlan = PackageBuilder.carrierSafeMultiBox().buildPlan();
        const { recipient, product, item, boxesCount } = OrderBuilder.domestic()
            .withPackagePlan(packagePlan)
            .withBoxes(3)
            .build();

        await AllureHelper.applyTestMetadata({
            displayName: `New Order Multi-Box (${boxesCount}) v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'new-order', 'multibox', 'orders', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'New Order Multi-Box (v2 PrimeNG)',
            story:    `Create order with ${boxesCount} boxes, get rates and confirm`,
        });

        const config = xenvio.config;

        console.log(`\n📦 Multi-Box Process: ${boxesCount} Boxes | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        // ── Step 1-2: Login + Open Shipper View ──
        const session = await xenvio.openSession();
        const popupPage = session.page;

        // ── Step 3: Create New Order ──
        const shipmentNumber = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient, product, config.warehouse);

        // ── Step 4: Wait for Shipment Detail ──
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(popupPage, shipmentNumber);

        // ── Steps 5a-5b: Create additional boxes and add items ──
        await PackageService.setupDomesticMultiBox(popupPage, orderToLabelPage, boxesCount, product, item);

        // ── Step 6: Get Rates ──
        await test.step('6. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 7: Select Rate and Save & Confirm ──
        await test.step('7. Select Rate and Save & Confirm', async () => {
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        console.log(`✅ Multi-Box order verified — ${boxesCount} boxes, rates selected, confirmed`);
    });
});
