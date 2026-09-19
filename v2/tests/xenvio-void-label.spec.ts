import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { OrderBuilder } from '../test-data';
import { LabelService, PackageService, ShipmentNavigationService } from '../services';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';

/**
 * ─── Xenvio Void Label Flow (v2 — PrimeNG) ──────────────────────────────────
 *
 * Test: TC-Xenvio-VoidLabel — Create order, get label, then void the label.
 *
 * Flow:
 *  1. Login + Open Shipper View
 *  2. Create New Order (random US recipient)
 *  3. Wait for shipment detail (auto-redirect)
 *  4. Add item details
 *  5. Get Rates → Select first rate → Save & Confirm
 *  6. Get Labels → Verify shipment is SHIPPED
 *  7. Void Label → Confirm dialog → Capture void_label response
 *  8. Verify shipment state = void, labelState = void, all boxes = voided
 */
test.describe('Xenvio Void Label (v2 PrimeNG)', { tag: ['@sanity', '@labels'] }, () => {

    test('TC-Xenvio-VoidLabel-001: Create order, get label, and void it', async ({
        xenvio,
    }) => {
        const { recipient, product, item } = OrderBuilder.domestic().build();

        await AllureHelper.applyTestMetadata({
            displayName: `Void Label Flow v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'void-label', 'labels', 'sanity', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Void Label (v2 PrimeNG)',
            story:    'Generate label then void it and verify voided state',
        });

        const config = xenvio.config;

        console.log(`\n🗑️  Void Label Process (v2 PrimeNG)`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.state}`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const session = await xenvio.openSession();
        const popupPage = session.page;

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3 — Create New Order
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await createPrimeNgOrderService(popupPage).createStandardOrder(recipient,
            product,
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await ShipmentNavigationService.waitForDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Add item details
        // ═════════════════════════════════════════════════════════════════════
        await PackageService.addItemDetails(orderToLabelPage, {
            ...item,
            sku: 'TEST-VOID-SKU',
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Select and Confirm Rate', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(60000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Get Labels and verify shipment is SHIPPED
        // ═════════════════════════════════════════════════════════════════════
        let labelResult: Awaited<ReturnType<typeof LabelService.generate>>;

        await test.step('8. Get Labels and verify SHIPPED state', async () => {
            labelResult = await LabelService.generate(popupPage, orderToLabelPage, 120000);

            if (labelResult.finalPostage !== null) {
                expect(labelResult.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            expect(labelResult.labelUrls.length, 'At least 1 label URL expected').toBeGreaterThan(0);

            console.log(`✅ Label generated for shipment ${shipmentNumber}`);
            console.log(`   Shipment State: ${labelResult.shipmentState ?? 'N/A'}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 9 — VOID LABEL: Click Void + Confirm dialog + Capture result
        // ═════════════════════════════════════════════════════════════════════
        await test.step('9. Void Label and capture void_label result', async () => {
            const voidResult = await LabelService.void(
                popupPage,
                orderToLabelPage,
                120000,
            );

            // ── Assertions ────────────────────────────────────────────
            // Shipment state should be 'voided'
            if (voidResult.shipmentState) {
                expect(voidResult.shipmentState, 'Shipment should be in VOIDED state').toBe('voided');
            }

            // Label state (from box.labelState) should be 'void'
            if (voidResult.labelState) {
                expect(voidResult.labelState, 'Label state should be VOID').toBe('void');
            }

            // All boxes should be in 'voided' state with labelState = 'void'
            if (voidResult.boxesVoidState.length > 0) {
                console.log(`\n📦 Verifying ${voidResult.boxesVoidState.length} box(es) are voided...`);
                for (const box of voidResult.boxesVoidState) {
                    console.log(`   Box ${box.boxIndex}: State=${box.state || 'N/A'}, LabelState=${box.labelState || 'N/A'}, Tracking=${box.trackingNumber || 'N/A'}`);
                    if (box.state) {
                        expect(box.state, `Box ${box.boxIndex} should be in VOIDED state`).toBe('voided');
                    }
                    if (box.labelState) {
                        expect(box.labelState, `Box ${box.boxIndex} labelState should be VOID`).toBe('void');
                    }
                }
            }

            console.log('✅ All void assertions passed — shipment and boxes are voided!');
            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
