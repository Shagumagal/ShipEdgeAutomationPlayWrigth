import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { OrderBuilder } from '../test-data';

/**
 * ─── Xenvio Order-to-Label — Individual Flow (v2 — PrimeNG) ──────────────────
 *
 * Test: TC-Xenvio-O2L-001 — Create one domestic (US) order and get its label.
 *
 * Same business flow as the legacy test, but using v2 page objects with:
 *   - PrimeNG p-select for warehouse/app selection
 *   - DynamicDialog modals for Add Box / Add Item
 *   - p-button for action bar (GET RATES, SAVE & CONFIRM, GET LABELS)
 *   - p-accordion for shipment panel
 *
 * Flow:
 *  1.  Login + Open Shipper View
 *  2.  Select Warehouse & App (via p-select)
 *  3.  Create New Order (random US recipient)
 *  4.  Search shipment & open O2L panel
 *  5.  Add item details to the box (via DynamicDialog modal)
 *  6.  Get Rates (via p-button)
 *  7.  Select rate (Ground Advantage) & Save + Confirm
 *  8.  Get Labels → capture finalPostage, shippingCost, label/doc URLs
 */
test.describe('Xenvio Order-to-Label — Individual (v2 PrimeNG)', { tag: ['@sanity', '@orders', '@labels'] }, () => {

    test('TC-Xenvio-O2L-001: Create domestic order and get label', async ({
        xenvio,
    }) => {
        const { recipient, product, item } = OrderBuilder.domestic().build();

        // ── Allure metadata ───────────────────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'o2l', 'orders', 'labels', 'sanity', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label (v2 PrimeNG)',
            story:    'Generate label for a single domestic order',
        });

        console.log(`\n📦 Domestic Order (v2 PrimeNG)`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);
        console.log(`   Warehouse : ${xenvio.config.warehouse}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const session = await xenvio.openSession();

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3 — Create New Order
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await session.orders.createStandardOrder(
            recipient,
            product,
            session.config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects after save)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await session.shipments.waitForDetailAfterCreation(shipmentNumber);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Add item details (via DynamicDialog modal)
        // ═════════════════════════════════════════════════════════════════════
        await session.packages.addItemDetails(orderToLabelPage, {
            ...item,
            sku: 'TEST-SKU-1',
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Get Rates (via p-button)
        // ═════════════════════════════════════════════════════════════════════
        await session.rates.request(orderToLabelPage, '6');

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await session.rates.selectFirstAndConfirm(orderToLabelPage, 60000, '7');

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Get Labels and capture label results
        // ═════════════════════════════════════════════════════════════════════
        await test.step('8. Get Labels and capture label results', async () => {
            const result = await session.labels.generate(orderToLabelPage, 120000);

            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            expect(result.labelUrls.length).toBeGreaterThan(0);

            console.log(`✅ Label successfully generated for shipment ${shipmentNumber}!`);
            await AllureHelper.attachScreenShot(session.page);
        });
    });

    // ─── After-each error capture ─────────────────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
