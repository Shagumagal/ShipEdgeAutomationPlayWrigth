import { test } from '../lib-v2/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';

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

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n🎲 Starting Rate Verification for: ${recipient.name} | ${recipient.zip}`);

        // ── Step 1-2: Login + Open Shipper View ──
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // ── Step 3: Create New Order ──
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // ── Step 4: Wait for Shipment Detail ──
        const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(popupPage, shipmentNumber);

        // ── Step 5: Add Item Details ──
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku:       'TEST-SKU-GET-RATES',
            country:   'us',
            unitPrice: '1',
        });

        // ── Step 6: Get Rates & Select ──
        await test.step('6. Get Rates and Select Rate', async () => {
            await orderToLabelPage.clickGetRates();
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 7: Save & Confirm ──
        await test.step('7. Save & Confirm', async () => {
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        console.log('✅ Workflow "Order to Get Rates" completed successfully');
    });
});
