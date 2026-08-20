import { test } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * ─── Xenvio Order-to-Label — Batch Flow (v2 — PrimeNG) ───────────────────────
 *
 * Test: TC-Xenvio-O2L-Batch — Create and label N domestic orders in a single session.
 *
 * Configuration via environment variables:
 *   ORDERS_TO_CREATE  — number of orders to process (default: 3)
 *
 * Notes:
 *  - Login happens ONCE; subsequent orders reuse the same session.
 *  - If the session is lost mid-run the test re-logs in automatically.
 *  - Individual order errors are caught without aborting the batch.
 *  - Dynamic timeout: 2 minutes per order.
 */
test.describe('Xenvio Order-to-Label — Batch (v2 PrimeNG)', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '3', 10);

    test(`TC-Xenvio-O2L-Batch: Create and label ${ordersToCreate} orders in a single session`, async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        test.setTimeout(ordersToCreate * 120 * 1000);

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label Batch v2 — ${ordersToCreate} orders`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'o2l', 'batch', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label (v2 PrimeNG)',
            story:    `Generate labels for ${ordersToCreate} domestic orders in batch`,
        });

        console.log(`\n🚀 Starting Batch (v2 PrimeNG) — ${ordersToCreate} order(s) to label`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═════════════════════════════════════════════════════════════════════
        // Login ONCE — session is reused for all orders in the batch
        // ═════════════════════════════════════════════════════════════════════
        let popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage,
            xenvioDashboardPage,
            config,
        );

        const results: { order: number; shipment: string; status: 'ok' | 'error'; detail: string }[] = [];

        for (let orderIndex = 1; orderIndex <= ordersToCreate; orderIndex++) {
            // ── Session guard: recover if the popup was closed ────────────────
            if (popupPage.isClosed() || !popupPage.url().includes('shipper-view')) {
                console.log(`\n⚠️ [Order ${orderIndex}] Session lost — re-logging in...`);
                try {
                    popupPage = await XenvioWorkflows.loginAndOpenShipperView(
                        xenvioLoginPage,
                        xenvioDashboardPage,
                        config,
                    );
                } catch (loginErr) {
                    console.error(`❌ [Order ${orderIndex}] Failed to restore session:`, loginErr);
                    results.push({ order: orderIndex, shipment: 'N/A', status: 'error', detail: 'Session restore failed' });
                    continue;
                }
            }

            const recipient = generateUSRecipient();
            console.log(`\n📦 [${orderIndex}/${ordersToCreate}] ${recipient.name} | ${recipient.city}, ${recipient.state}`);

            try {
                // ── Create Order ─────────────────────────────────────────────
                const shipmentNumber = await XenvioWorkflows.createStandardOrder(
                    popupPage,
                    recipient,
                    StandardPackage,
                    config.warehouse,
                );

                // ── Wait for shipment detail (auto-redirect) ─────────────────
                const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(
                    popupPage,
                    shipmentNumber,
                );

                // ── Add Item Details ─────────────────────────────────────────
                await XenvioWorkflows.addItemDetails(orderToLabelPage, {
                    ...StandardPackage,
                    sku:       `BATCH-SKU-${orderIndex}`,
                    country:   'us',
                    unitPrice: '1',
                });

                // ── Get Rates ────────────────────────────────────────────────
                await test.step(`[${orderIndex}/${ordersToCreate}] Get Rates`, async () => {
                    await orderToLabelPage.clickGetRates();
                });

                // ── Select Rate & Confirm ────────────────────────────────────
                await test.step(`[${orderIndex}/${ordersToCreate}] Select Rate`, async () => {
                    await orderToLabelPage.ratesModal.selectFirstRate(60000);
                    await orderToLabelPage.clickSaveAndConfirm();
                });

                // ── Get Labels and capture results ───────────────────────────
                await test.step(`[${orderIndex}/${ordersToCreate}] Get Labels`, async () => {
                    const result = await XenvioWorkflows.getLabelsAndCaptureResult(
                        popupPage,
                        orderToLabelPage,
                        120000,
                    );
                    results.push({
                        order:    orderIndex,
                        shipment: shipmentNumber,
                        status:   'ok',
                        detail:   `finalPostage: ${result.finalPostage ?? 'N/A'} | labels: ${result.labelUrls.length}`,
                    });
                });

            } catch (orderErr) {
                console.error(`❌ [Order ${orderIndex}] Failed:`, orderErr);
                results.push({ order: orderIndex, shipment: 'N/A', status: 'error', detail: String(orderErr) });

                // ── Recovery: navigate back to clear state ────────────────────
                try {
                    if (!popupPage.isClosed()) {
                        const currentUrl = popupPage.url();
                        if (currentUrl.includes('shipper-view')) {
                            const baseUrl = currentUrl.split('?')[0];
                            console.log(`🔄 Resetting state → ${baseUrl}`);
                            await popupPage.goto(baseUrl);
                            await popupPage.waitForLoadState('networkidle');
                        } else {
                            console.log('🔄 Reloading page...');
                            await popupPage.reload();
                            await popupPage.waitForLoadState('networkidle');
                        }
                    }
                } catch (cleanupErr) {
                    console.error('⚠️ Cleanup failed:', cleanupErr);
                }
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // Batch summary
        // ═════════════════════════════════════════════════════════════════════
        const ok     = results.filter(r => r.status === 'ok').length;
        const failed = results.filter(r => r.status === 'error').length;

        console.log('\n══════════════════════════════════════════════');
        console.log(`  📊 BATCH SUMMARY — ${ok}/${ordersToCreate} successful, ${failed} failed`);
        console.log('══════════════════════════════════════════════');
        results.forEach(r => {
            const icon = r.status === 'ok' ? '✅' : '❌';
            console.log(`  ${icon} Order ${r.order}: ${r.shipment} — ${r.detail}`);
        });
        console.log('══════════════════════════════════════════════\n');

        await AllureHelper.attachScreenShot(popupPage);
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
