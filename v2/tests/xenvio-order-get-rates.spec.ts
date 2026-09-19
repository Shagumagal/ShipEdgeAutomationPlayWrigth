import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { OrderBuilder } from '../test-data';
import { PackageService, RatesService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio Order Get Rates (v2 — PrimeNG) ─────────────────────────────────
 *
 * Creates an order, adds item details, gets rates, selects a rate,
 * and confirms with Save & Confirm. Does NOT generate labels.
 * Verifies the rates engine works correctly.
 */
test.describe('Xenvio Order Get Rates (v2 PrimeNG)', { tag: ['@smoke', '@rates'] }, () => {

    test('TC-Xenvio-GR-001: Create order and request rates', async ({
        xenvio,
    }) => {
        const { recipient, product, item } = OrderBuilder.domestic().build();

        await AllureHelper.applyTestMetadata({
            displayName: `Order to Get Rates v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'get-rates', 'rates', 'smoke', 'v2', 'primeng'],
            severity: 'normal',
            epic:     'Xenvio',
            feature:  'Rates Engine (v2 PrimeNG)',
            story:    'Verify rates appear in modal and can be selected',
        });

        const config = xenvio.config;

        console.log(`\n🎲 Starting Rate Verification for: ${recipient.name} | ${recipient.zip}`);

        // ── Step 1-2: Login + Open Shipper View ──
        const session = await xenvio.openSession();
        const popupPage = session.page;

        // ── Step 3: Create New Order ──
        const shipmentNumber = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient, product, config.warehouse);

        // ── Step 4: Wait for Shipment Detail ──
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(popupPage, shipmentNumber);

        // ── Step 5: Add Item Details ──
        await PackageService.addItemDetails(orderToLabelPage, {
            ...item,
            sku: 'TEST-SKU-GET-RATES',
        });

        // ── Step 6: Get Rates ──
        await RatesService.request(popupPage, orderToLabelPage, '6');

        // ── Step 7: Select Rate & Confirm ──
        await RatesService.selectByTextAndConfirm(
            popupPage,
            orderToLabelPage,
            'Ground Advantage',
            '7',
        );

        console.log('✅ Workflow "Order to Get Rates" completed successfully');
    });
});
