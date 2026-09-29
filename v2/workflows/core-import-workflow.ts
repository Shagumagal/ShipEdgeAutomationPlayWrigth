import { Page, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { ShipedgeLoginPage } from '../page-objects/core/shipedge-login-page';
import { ShipedgeOrdersPage } from '../page-objects/core/shipedge-orders-page';
import type { CoreImportVerification } from '../domain/orders/core-import-verification';
import {
    injectMultiResponseInterceptor,
    pollCapturedResponses,
    restoreMultiFetch,
} from '../infrastructure/network-capture';
import { logImportVerification } from '../parsers/core-import-logger';
import { parseImportedShipmentData } from '../parsers/core-import-parser';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';

export type { CoreImportVerification };

/**
 * Cross-system flow between ShipEdge Core (Rails) and Xenvio (Angular/PrimeNG):
 * create an order in Core, then find the imported shipment in Xenvio.
 *
 * Browser orchestration only. The response contract lives in
 * domain/orders/core-import-verification.ts, its parsing in parsers/core-import-parser.ts
 * and the console output in parsers/core-import-logger.ts.
 */
export class CoreImportWorkflows {

    // ═══════════════════════════════════════════════════════════════════
    // Part A — ShipEdge Core: Create Order
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Login to ShipEdge Core (Rails app) and create a new order.
     * Returns the captured orderId from Core.
     */
    static async loginAndCreateOrderInCore(
        page: Page,
        config: { coreUrl: string; email: string; password: string }
    ): Promise<string> {
        const shipedgeLogin = new ShipedgeLoginPage(page);
        const shipedgeOrders = new ShipedgeOrdersPage(page);

        // ── Login to ShipEdge Core ──────────────────────────
        const orderId = await allure.step('Login to ShipEdge Core and Create Order', async () => {

            await allure.step('Login to ShipEdge Core', async () => {
                console.log(`🔑 Logging in to ShipEdge Core: ${config.coreUrl}`);
                await page.goto(`${config.coreUrl}/login.php`);
                await page.waitForLoadState('networkidle');
                await shipedgeLogin.login(config.email, config.password);
                await shipedgeLogin.waitForSuccessfulLogin();
                console.log('✅ ShipEdge Core login successful');
                await AllureHelper.attachScreenShot(page, 'ShipEdge Core signed in');
            });

            // ── Handle popup ────────────────────────────────
            await allure.step('Handle Remind Me Later popup', async () => {
                await shipedgeOrders.handleRemindMeLaterPopup();
            });

            // ── Create Order ────────────────────────────────
            await allure.step('Create Order (Address Book + Products + Shipping + Save)', async () => {
                console.log('📝 Starting order creation flow...');
                await shipedgeOrders.startCreateOrderFlow();
                console.log('✅ Order creation flow completed');
                await AllureHelper.attachScreenShot(page, 'Order completed in Core');
            });

            // ── Wait for order to be saved ──────────────────
            await allure.step('Verify Order Saved', async () => {
                await shipedgeOrders.waitForOrderCreated(20000);
                // Verify we moved away from the new order blank form
                await expect(page).not.toHaveURL(/typeorder=regular/);
                console.log(`✅ Order saved. Current URL: ${page.url()}`);
                await AllureHelper.attachScreenShot(page, 'Order saved in Core');
            });

            // ── Capture Order ID ────────────────────────────
            const capturedId = await allure.step('Capture Created Order ID', async () => {
                const id = await shipedgeOrders.getCreatedOrderId();
                if (!id) {
                    throw new Error('⚠️ Could not capture the Order ID from ShipEdge Core');
                }
                console.log(`🎉 ShipEdge Order created — Order ID: ${id}`);
                await allure.attachment('Created Order ID', id, 'text/plain');
                await AllureHelper.attachScreenShot(page, 'Order id in Core');
                return id;
            });

            return capturedId;
        });

        return orderId;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Part B — Xenvio: Search & Capture Imported Shipment Data
    // ═══════════════════════════════════════════════════════════════════

    /**
     * In Xenvio Shipper View, select warehouse/app, search for the shipment,
     * and capture the full shipment data from the `search_by_warehouse` API response.
     *
     * Endpoint: POST /shipments/search_by_warehouse
     *
     * NOTE: This endpoint is called TWICE when a new shipment is imported:
     *   1st call — triggers the import from Core (ImportShipmentService.call)
     *   2nd call — may happen when the Angular component reloads the detail view
     * We capture ALL responses and pick the one with the richest data
     * (customer + boxes present), to ensure we always get the import result.
     *
     * Uses the browser-side fetch monkey-patch pattern (immune to CDP eviction).
     *
     * @param popupPage      - The Xenvio Shipper View popup Page
     * @param shipmentNumber - The order/shipment number to search for
     * @param config         - { warehouse, app } selection config
     */
    static async searchAndCaptureShipmentInXenvio(
        popupPage: Page,
        shipmentNumber: string,
        config: { warehouse: string; app: string }
    ): Promise<CoreImportVerification> {
        return await allure.step('Search and Capture Imported Shipment in Xenvio', async () => {
            const shipperView = new XenvioShipperViewPage(popupPage);

            // ── 3a. Select Warehouse ────────────────────────────────────────
            await allure.step('Select Warehouse', async () => {
                console.log(`📦 Selecting Warehouse: "${config.warehouse}"`);
                await shipperView.selectWarehouse(config.warehouse);
                await AllureHelper.attachScreenShot(popupPage, 'Warehouse selected');
            });

            // ── 3b. Select App ──────────────────────────────────────────────
            await allure.step('Select App', async () => {
                console.log(`📱 Selecting App: "${config.app}"`);
                await shipperView.selectApplication(config.app);
                await AllureHelper.attachScreenShot(popupPage, 'App selected');
            });

            // ── 3c. Inject fetch interceptor BEFORE triggering search ───────
            // Uses the browser-side monkey-patch (same as task_executor pattern)
            // so we are immune to CDP buffer eviction. Captures ALL responses from
            // search_by_warehouse into an array (there can be 2 calls).
            console.log('🔍 Injecting fetch interceptor for search_by_warehouse...');
            await injectMultiResponseInterceptor(popupPage, 'search_by_warehouse');

            let capturedResponse: any = null;

            try {
                // ── 3d. Type shipment number and click Search ───────────────
                await allure.step(`Search for Shipment: ${shipmentNumber}`, async () => {
                    console.log(`🔍 Typing shipment number: ${shipmentNumber}`);
                    await shipperView.searchShipment(shipmentNumber);
                    console.log('✅ Search triggered');
                    await AllureHelper.attachScreenShot(popupPage, 'Search result');
                });

                // ── 3e. Poll for captured responses ────────────────────────
                // Wait up to 60s for at least 1 response (import may take time)
                await allure.step('Capture search_by_warehouse Response(s)', async () => {
                    console.log('⏳ Polling for search_by_warehouse response(s)...');
                    const responses = await pollCapturedResponses(popupPage, 60000, 1, 500);

                    if (responses.length === 0) {
                        console.warn('⚠️ No search_by_warehouse responses captured (timeout)');
                        return;
                    }

                    console.log(`📡 Captured ${responses.length} search_by_warehouse response(s)`);

                    // Pick the richest response: prefer one that has shipment data
                    // with customer AND box data (the import result), not just the
                    // first call that may only return carrier/rate data.
                    const richest = responses.reduce((best: any, current: any) => {
                        const hasCustomer = !!current?.shipments?.[0]?.customer;
                        const hasBoxes   = (current?.shipments?.[0]?.boxes?.length ?? 0) > 0;
                        const bestScore  = (best?.shipments?.[0]?.customer ? 2 : 0) +
                                          ((best?.shipments?.[0]?.boxes?.length ?? 0) > 0 ? 1 : 0);
                        const currScore  = (hasCustomer ? 2 : 0) + (hasBoxes ? 1 : 0);
                        return currScore >= bestScore ? current : best;
                    }, responses[0]);

                    capturedResponse = richest;
                    console.log(`✅ Using response with shipment ID: ${richest?.shipments?.[0]?.id ?? 'unknown'}`);
                });

            } finally {
                await restoreMultiFetch(popupPage);
            }

            // ── Parse the captured response ─────────────────────────────────
            const result = this.parseImportedShipmentData(capturedResponse);

            // ── Log the verification results ────────────────────────
            this.logImportVerification(result);

            // ── Attach JSON to Allure report ────────────────────────
            if (capturedResponse) {
                await AllureHelper.attachJSON(
                    popupPage,
                    'Imported Shipment Data (search_by_warehouse)',
                    capturedResponse
                );
            }

            // ── 3f. Wait for Xenvio UI to render the imported shipment ─────
            // After the search_by_warehouse response lands, Angular renders the
            // Packing Station view. Wait a few seconds so the video recording
            // captures the fully loaded shipment UI as final evidence.
            await allure.step('UI Evidence — Imported Shipment View', async () => {
                try {
                    // Wait for the packing station content to appear
                    // (any of the typical elements: shipment number, box header, items table)
                    await popupPage.waitForSelector(
                        'app-sv-boxes, app-packing-station, .packing-station, [class*="packing"], [class*="box"]',
                        { state: 'visible', timeout: 15000 }
                    );
                } catch {
                    // Not fatal — UI may already be visible or use a different selector
                }

                // Extra wait so the video recording shows the final state clearly
                await popupPage.waitForTimeout(3000);

                // Final screenshot as image evidence
                console.log(`📸 Capturing final UI evidence for Order ${result.shipmentNumber ?? '(unknown)'}`);
                await AllureHelper.attachScreenShot(popupPage, 'Imported shipment in Xenvio');
                console.log('✅ UI evidence captured');
            });

            return result;
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Parsing & Logging
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Parse the search_by_warehouse response into a structured CoreImportVerification object.
     */
    /** Parse the captured response into the verification contract. */
    static parseImportedShipmentData(responseBody: any): CoreImportVerification {
        return parseImportedShipmentData(responseBody);
    }

    /** Print the imported shipment tables in the run output. */
    static logImportVerification(result: CoreImportVerification): void {
        logImportVerification(result);
    }
}
