import { test, expect } from '../lib-v2/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';

/**
 * ─── Xenvio New Order (v2 — PrimeNG) ────────────────────────────────────────
 *
 * Creates a single domestic (US) order with random recipient data.
 * Verifies that the order is created successfully and the shipment number
 * is returned. Supports creating multiple orders via ORDERS_TO_CREATE env var.
 */
test.describe('Xenvio New Order (v2 PrimeNG)', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);

    for (let i = 0; i < ordersToCreate; i++) {
        const orderIndex = i + 1;

        test(`TC-Xenvio-NewOrder-${String(orderIndex).padStart(3, '0')}: Create order #${orderIndex} with random US address`, async ({
            xenvioLoginPage,
            xenvioDashboardPage,
        }) => {
            const recipient = generateUSRecipient();

            await AllureHelper.applyTestMetadata({
                displayName: `New Order v2 #${orderIndex} — ${recipient.city}, ${recipient.state}`,
                owner:    'QA Automation Team',
                tags:     ['xenvio', 'new-order', 'v2', 'primeng'],
                severity: 'critical',
                epic:     'Xenvio',
                feature:  'New Order (v2 PrimeNG)',
                story:    `Order creation (${orderIndex} of ${ordersToCreate})`,
            });

            const config = {
                url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
                email:     process.env.XENVIO_EMAIL!,
                pass:      process.env.XENVIO_PASSWORD!,
                app:       process.env.APP_XENVIO!,
                warehouse: process.env.WAREHOUSE_XENVIO!,
            };

            console.log(`\n🎲 Order ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

            // ── Step 1-2: Login + Open Shipper View ──
            const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

            // ── Step 3: Create New Order ──
            const finalShipment = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

            expect(finalShipment).not.toBeNull();
            console.log(`✅ Order ${orderIndex}/${ordersToCreate} created successfully! Shipment: ${finalShipment}`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }
});
