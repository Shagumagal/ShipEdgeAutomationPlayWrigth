import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { PackageService, RatesService, SessionService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio Order Get Rates (v2 — PrimeNG) ─────────────────────────────────
 *
 * Creates an order, adds item details, gets rates, selects a rate,
 * and confirms with Save & Confirm. Does NOT generate labels.
 * Verifies the rates engine works correctly.
 */
test.describe('Xenvio Order Get Rates (v2 PrimeNG)', () => {

    test('TC-Xenvio-GR-001: Create order and request rates', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
        xenvioConfig,
    }) => {
        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: `Order to Get Rates v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'get-rates', 'smoke', 'v2', 'primeng'],
            severity: 'normal',
            epic:     'Xenvio',
            feature:  'Rates Engine (v2 PrimeNG)',
            story:    'Verify rates appear in modal and can be selected',
        });

        const config = xenvioConfig;

        console.log(`\n🎲 Starting Rate Verification for: ${recipient.name} | ${recipient.zip}`);

        // ── Step 1-2: Login + Open Shipper View ──
        const popupPage = await SessionService.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // ── Step 3: Create New Order ──
        const shipmentNumber = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient, StandardPackage, config.warehouse);

        // ── Step 4: Wait for Shipment Detail ──
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(popupPage, shipmentNumber);

        // ── Step 5: Add Item Details ──
        await PackageService.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku:       'TEST-SKU-GET-RATES',
            country:   'us',
            unitPrice: '1',
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
