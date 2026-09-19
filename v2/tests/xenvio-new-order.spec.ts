import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { OrderBuilder } from '../test-data';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio New Order (v2 — PrimeNG) ────────────────────────────────────────
 *
 * Creates a single domestic (US) order with random recipient data.
 * Verifies that the order is created successfully and the shipment number
 * is returned. Supports creating multiple orders via ORDERS_TO_CREATE env var.
 */
test.describe('Xenvio New Order (v2 PrimeNG)', { tag: ['@sanity', '@orders'] }, () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);

    for (let i = 0; i < ordersToCreate; i++) {
        const orderIndex = i + 1;

        test(`TC-Xenvio-NewOrder-${String(orderIndex).padStart(3, '0')}: Create order #${orderIndex} with random US address`, async ({
            xenvio,
        }) => {
            const { recipient, product } = OrderBuilder.domestic().build();

            await AllureHelper.applyTestMetadata({
                displayName: `New Order v2 #${orderIndex} — ${recipient.city}, ${recipient.state}`,
                owner:    'QA Automation Team',
                tags:     ['xenvio', 'new-order', 'orders', 'sanity', 'v2', 'primeng'],
                severity: 'critical',
                epic:     'Xenvio',
                feature:  'New Order (v2 PrimeNG)',
                story:    `Order creation (${orderIndex} of ${ordersToCreate})`,
            });

            const config = xenvio.config;

            console.log(`\n🎲 Order ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

            // ── Step 1-2: Login + Open Shipper View ──
            const session = await xenvio.openSession();
            const popupPage = session.page;

            // ── Step 3: Create New Order ──
            const finalShipment = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient, product, config.warehouse);

            expect(finalShipment).not.toBeNull();
            console.log(`✅ Order ${orderIndex}/${ordersToCreate} created successfully! Shipment: ${finalShipment}`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }
});
