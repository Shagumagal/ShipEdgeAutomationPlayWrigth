import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from "../evidence/allure-helper";
import { InternationalRecipients, StandardInternationalItem } from "../test-data";
import { LabelService, PackageService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio – International Order Multi-Box Flow (v2 — PrimeNG) ───────────────
 *
 * Test: TC-Xenvio-Intl-MultiBox-001 — Create a 3-box international order (UK)
 *
 * Flow:
 *  1. Login + Open Shipper View
 *  2. Create Order with international address (10 Downing St, London, GB)
 *  3. Wait for shipment detail (auto-redirect)
 *  4. Setup 3 boxes with international items (shared workflow)
 *  5. Get Rates → Select first rate → Save & Confirm
 *  6. Get Labels → Capture per-box label results (1 label per box)
 */
test.describe('Xenvio Shipper View – International Order Multi-Box (v2 PrimeNG)', { tag: ['@e2e', '@orders', '@labels'] }, () => {

    test('TC-Xenvio-Intl-MultiBox-001: Create 3-box international order (UK) and get labels', async ({
        xenvio,
    }) => {

        const recipient  = InternationalRecipients.uk;
        const item       = StandardInternationalItem;
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label International Multi-Box (${boxesCount}) v2 — ${recipient.city}, ${recipient.country}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'international', 'multibox', 'orders', 'labels', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label International (v2 PrimeNG)',
            story:    `Generate labels for ${boxesCount}-box international order (${recipient.city}, ${recipient.country})`,
        });

        const config = xenvio.config;

        await AllureHelper.addRunParameters({
            Boxes: `${boxesCount}`,
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
                weight: '5',    // Box weight > commodity weight — carrier validation passes
            },
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);
        await AllureHelper.attachScreenShot(popupPage);

        // ═════════════════════════════════════════════════════════════════════
        // Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // Setup multi-box: create additional boxes + add intl items
        // ═════════════════════════════════════════════════════════════════════
        await PackageService.setupInternationalMultiBox(
            popupPage,
            orderToLabelPage,
            boxesCount,
            item,
            '5',  // boxWeight
        );

        // ═════════════════════════════════════════════════════════════════════
        // Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Select Rate and Save & Confirm', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(90000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Get Labels and capture per-box results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Get Labels and capture per-box results', async () => {
            const result = await LabelService.generate(popupPage, orderToLabelPage, 180000);

            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            // Verify we have a label for each box
            expect(result.labelsByBox.length).toBe(boxesCount);
            for (const boxLabel of result.labelsByBox) {
                expect(boxLabel.label, `Box ${boxLabel.boxIndex} must have a valid label URL`).toMatch(/^https?:\/\/.*\.pdf.*/i);
            }

            await AllureHelper.attachScreenShot(popupPage);
        });
    });
});
