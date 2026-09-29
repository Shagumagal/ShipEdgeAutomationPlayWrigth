import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from "../evidence/allure-helper";
import { InternationalRecipients, StandardInternationalItem } from "../test-data";
import { LabelService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio – International Order Flow (v2 — PrimeNG) ─────────────────────────
 *
 * Test: TC-Xenvio-Intl-001 — Create an international order (UK) and get label
 *
 * Flow:
 *  1. Login + Open Shipper View
 *  2. Create Order with international address (10 Downing St, London, GB)
 *  3. Wait for shipment detail (auto-redirect)
 *  4. Add international item details (SKU, description, harmonization code, country of origin)
 *  5. Get Rates → Select first rate → Save & Confirm
 *  6. Get Labels → Capture finalPostage, shippingCost, label URLs
 */
test.describe('Xenvio Shipper View – International Order (v2 PrimeNG)', { tag: ['@e2e', '@orders', '@labels'] }, () => {

    test('TC-Xenvio-Intl-001: Create international order (UK) and get label', async ({
        xenvio,
    }) => {

        const recipient = InternationalRecipients.uk;
        const item      = StandardInternationalItem;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label International v2 — ${recipient.city}, ${recipient.country}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'international', 'orders', 'labels', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label International (v2 PrimeNG)',
            story:    `Generate label for international order (${recipient.city}, ${recipient.country})`,
        });

        const config = xenvio.config;

        await AllureHelper.addRunParameters({
            Recipient: `${recipient.name} | ${recipient.city}, ${recipient.country}`,
        });

        // ═════════════════════════════════════════════════════════════════════
        // Login and Open Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const session = await xenvio.openSession();
        const popupPage = session.page;

        // ═════════════════════════════════════════════════════════════════════
        // Create Order with international address
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient,
            {
                qty:    item.qty,
                length: item.length,
                width:  item.width,
                height: item.height,
                weight: '5',
            },
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);
        await AllureHelper.attachScreenShot(popupPage, 'International order created');

        // ═════════════════════════════════════════════════════════════════════
        // Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // Add international item details
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Add international item details', async () => {
            await orderToLabelPage.boxForm.clickAddItem();
            await AllureHelper.attachScreenShot(popupPage, 'Add international item details');

            await orderToLabelPage.boxForm.fillInternationalItemDetails({
                sku:               item.sku,
                weight:            item.weight,
                length:            item.length,
                width:             item.width,
                height:            item.height,
                itemDescription:   item.itemDescription,
                harmonizationCode: item.harmonizationCode,
                countryOfOrigin:   item.countryOfOrigin,
                unitPrice:         item.unitPrice,
                qty:               item.qty,
            });

            await orderToLabelPage.boxForm.clickApplyItem();
            await orderToLabelPage.waitForXenvioLoading(30000);
            await AllureHelper.attachScreenShot(popupPage, 'Add international item details');
        });

        // ═════════════════════════════════════════════════════════════════════
        // Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage, 'Get Rates');
        });

        // ═════════════════════════════════════════════════════════════════════
        // Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Select Rate and Save & Confirm', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(90000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage, 'Select Rate and Save & Confirm');
        });

        // ═════════════════════════════════════════════════════════════════════
        // Get Labels and capture results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Get Labels and capture label results', async () => {
            const result = await LabelService.generate(popupPage, orderToLabelPage, 120000);

            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            expect(result.labelUrls.length).toBeGreaterThan(0);

            await AllureHelper.attachScreenShot(popupPage, 'Get Labels and capture label results');
        });
    });
});
