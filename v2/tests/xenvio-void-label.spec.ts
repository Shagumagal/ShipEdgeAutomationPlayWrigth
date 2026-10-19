import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from "../evidence/allure-helper";
import { OrderBuilder } from '../test-data';
import { LabelService, ShipmentNavigationService } from '../services';

/**
 * ─── Xenvio Void Label Flow (v2 — PrimeNG) ──────────────────────────────────
 *
 * Test: TC-Xenvio-VoidLabel — Void the label of a shipped order.
 *
 * The order is created through API v3 already shipped (setup, no UI); the UI is used only for
 * the void, which is what this test covers. Label generation through the UI is covered by the
 * order-to-label tests.
 *
 * Flow:
 *  1. Create a shipped order through API v3 (random US recipient, API_ORDER_SHIP_CODE)
 *  2. Login + open the shipment in the Shipper View
 *  3. Void Label → Confirm dialog → Capture void_label response
 *  4. Verify shipment state = voided, labelState = void, all boxes = voided
 */
test.describe('Xenvio Void Label (v2 PrimeNG)', { tag: ['@sanity', '@labels'] }, () => {

    test('TC-Xenvio-VoidLabel-001: Create order, get label, and void it', async ({
        xenvio,
        apiOrders,
    }) => {
        const order = OrderBuilder.domestic().build();
        const { recipient } = order;

        await AllureHelper.applyTestMetadata({
            displayName: `Void Label Flow v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'void-label', 'labels', 'sanity', 'v2', 'primeng', 'api-setup'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Void Label (v2 PrimeNG)',
            story:    'Void the label of an order shipped through the API and verify voided state',
        });

        const config = xenvio.config;

        await AllureHelper.addRunParameters({
            Recipient: `${recipient.name} | ${recipient.city}, ${recipient.state}`,
        });

        // ═════════════════════════════════════════════════════════════════════
        // Shipped order (API v3 setup)
        // ═════════════════════════════════════════════════════════════════════
        const shipped = await apiOrders.createShippedOrder(order, config.warehouse);

        // ═════════════════════════════════════════════════════════════════════
        // Login and open the shipment in the Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const session = await xenvio.openSession();
        const popupPage = session.page;

        const orderToLabelPage = await ShipmentNavigationService.openByUrl(popupPage, {
            shipmentNumber: shipped.shipmentNumber,
            warehouseId: shipped.warehouseId,
            appId: 0,
        });

        // ═════════════════════════════════════════════════════════════════════
        // VOID LABEL: Click Void + Confirm dialog + Capture result
        // ═════════════════════════════════════════════════════════════════════
        await test.step('Void Label and capture void_label result', async () => {
            const voidResult = await LabelService.void(
                popupPage,
                orderToLabelPage,
                120000,
            );

            // ── Assertions (all mandatory: missing data fails, it is never skipped) ──
            expect(
                voidResult.shipmentNumber,
                'The void_label response must be captured and belong to the shipment created by this test',
            ).toBe(shipped.shipmentNumber);
            expect(voidResult.shipmentState, 'Shipment should be in VOIDED state').toBe('voided');
            expect(voidResult.labelState, 'Label state should be VOID').toBe('void');
            expect(voidResult.boxesVoidState.length, 'The void_label response must list the boxes').toBeGreaterThan(0);

            console.log(`\n📦 Verifying ${voidResult.boxesVoidState.length} box(es) are voided...`);
            for (const box of voidResult.boxesVoidState) {
                console.log(`   Box ${box.boxIndex}: State=${box.state || 'N/A'}, LabelState=${box.labelState || 'N/A'}, Tracking=${box.trackingNumber || 'N/A'}`);
                expect(box.state, `Box ${box.boxIndex} should be in VOIDED state`).toBe('voided');
                expect(box.labelState, `Box ${box.boxIndex} labelState should be VOID`).toBe('void');
            }

            await AllureHelper.attachScreenShot(popupPage, 'Void Label and capture void_label result');
        });
    });
});
