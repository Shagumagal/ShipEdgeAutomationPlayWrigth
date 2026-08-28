import { Page, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { ShipedgeLoginPage } from '../../v1/page-objects/shipedge-login-page';
import { ShipedgeOrdersPage } from '../../v1/page-objects/shipedge-orders-page';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import {
    injectMultiResponseInterceptor,
    pollCapturedResponses,
    restoreMultiFetch,
} from './network-capture';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CoreImportVerification {
    // Shipment-level
    shipmentNumber: string | null;
    orderNumber: string | null;
    aasmState: string | null;
    shippingMethodCode: string | null;

    // Customer
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: {
        address1: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
    } | null;

    // Boxes & Items
    boxes: Array<{
        boxNumber: string | null;
        length: string | null;
        width: string | null;
        height: string | null;
        weight: string | null;
        aasmState: string | null;
        items: Array<{
            sku: string | null;
            quantity: number | null;
            weight: number | null;
            price: number | null;
            description: string | null;
        }>;
    }>;

    // Carrier
    carrierName: string | null;
    shippingMethodName: string | null;

    // Warehouse / App
    warehouseName: string | null;
    appName: string | null;

    // Raw response for additional checks
    rawResponse: any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core Import Workflows — Cross-system flows (ShipEdge Core ↔ Xenvio)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Workflows for cross-system integration between ShipEdge Core (Rails)
 * and Xenvio (Angular/PrimeNG).
 *
 * Separated from XenvioWorkflows to follow single-responsibility principle —
 * these flows involve two different applications with different tech stacks.
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

        // ── Step 1: Login to ShipEdge Core ──────────────────────────
        const orderId = await allure.step('1. Login to ShipEdge Core and Create Order', async () => {

            await allure.step('1a. Login to ShipEdge Core', async () => {
                console.log(`🔑 Logging in to ShipEdge Core: ${config.coreUrl}`);
                await page.goto(`${config.coreUrl}/login.php`);
                await page.waitForLoadState('networkidle');
                await shipedgeLogin.login(config.email, config.password);
                await shipedgeLogin.waitForSuccessfulLogin();
                console.log('✅ ShipEdge Core login successful');
                await AllureHelper.attachScreenShot(page);
            });

            // ── Step 2: Handle popup ────────────────────────────────
            await allure.step('1b. Handle Remind Me Later popup', async () => {
                await shipedgeOrders.handleRemindMeLaterPopup();
            });

            // ── Step 3: Create Order ────────────────────────────────
            await allure.step('1c. Create Order (Address Book + Products + Shipping + Save)', async () => {
                console.log('📝 Starting order creation flow...');
                await shipedgeOrders.startCreateOrderFlow();
                console.log('✅ Order creation flow completed');
                await AllureHelper.attachScreenShot(page);
            });

            // ── Step 4: Wait for order to be saved ──────────────────
            await allure.step('1d. Verify Order Saved', async () => {
                await shipedgeOrders.waitForOrderCreated(20000);
                // Verify we moved away from the new order blank form
                await expect(page).not.toHaveURL(/typeorder=regular/);
                console.log(`✅ Order saved. Current URL: ${page.url()}`);
                await AllureHelper.attachScreenShot(page);
            });

            // ── Step 5: Capture Order ID ────────────────────────────
            const capturedId = await allure.step('1e. Capture Created Order ID', async () => {
                const id = await shipedgeOrders.getCreatedOrderId();
                if (!id) {
                    throw new Error('⚠️ Could not capture the Order ID from ShipEdge Core');
                }
                console.log(`🎉 ShipEdge Order created — Order ID: ${id}`);
                await allure.attachment('Created Order ID', id, 'text/plain');
                await AllureHelper.attachScreenShot(page);
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
        return await allure.step('3. Search and Capture Imported Shipment in Xenvio', async () => {
            const shipperView = new XenvioShipperViewPage(popupPage);

            // ── 3a. Select Warehouse ────────────────────────────────────────
            await allure.step('3a. Select Warehouse', async () => {
                console.log(`📦 Selecting Warehouse: "${config.warehouse}"`);
                await shipperView.selectWarehouse(config.warehouse);
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ── 3b. Select App ──────────────────────────────────────────────
            await allure.step('3b. Select App', async () => {
                console.log(`📱 Selecting App: "${config.app}"`);
                await shipperView.selectApplication(config.app);
                await AllureHelper.attachScreenShot(popupPage);
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
                await allure.step(`3c. Search for Shipment: ${shipmentNumber}`, async () => {
                    console.log(`🔍 Typing shipment number: ${shipmentNumber}`);
                    await shipperView.searchShipment(shipmentNumber);
                    console.log('✅ Search triggered');
                    await AllureHelper.attachScreenShot(popupPage);
                });

                // ── 3e. Poll for captured responses ────────────────────────
                // Wait up to 60s for at least 1 response (import may take time)
                await allure.step('3d. Capture search_by_warehouse Response(s)', async () => {
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
                        const bestScore  = (!!best?.shipments?.[0]?.customer ? 2 : 0) +
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
            await allure.step('3e. UI Evidence — Imported Shipment View', async () => {
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
                await AllureHelper.attachScreenShot(popupPage);
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
    static parseImportedShipmentData(responseBody: any): CoreImportVerification {
        const shipment = responseBody?.shipments?.[0];

        if (!shipment) {
            console.warn('⚠️ No shipment data found in search_by_warehouse response');
            return {
                shipmentNumber: null, orderNumber: null, aasmState: null,
                shippingMethodCode: null, customerName: null, customerEmail: null,
                customerPhone: null, customerAddress: null, boxes: [],
                carrierName: null, shippingMethodName: null,
                warehouseName: null, appName: null, rawResponse: responseBody,
            };
        }

        const customer = shipment.customer;
        const order = shipment.order;
        const methodConfig = shipment.shippingMethodConfig;

        return {
            shipmentNumber: shipment.shipmentNumber || null,
            orderNumber: order?.orderNumber || null,
            aasmState: shipment.aasmState || null,
            shippingMethodCode: methodConfig?.clientCode || shipment.shippingMethodCode || null,

            customerName: customer?.name || null,
            customerEmail: customer?.email || null,
            customerPhone: customer?.phone || null,
            customerAddress: customer?.address ? {
                address1: customer.address.address1 || null,
                city: customer.address.city || null,
                state: customer.address.state || null,
                zip: customer.address.zip || null,
                country: customer.address.country || null,
            } : null,

            boxes: (shipment.boxes || []).map((box: any) => ({
                boxNumber: box.boxNumber || null,
                length: box.length || null,
                width: box.width || null,
                height: box.height || null,
                weight: box.weight || null,
                aasmState: box.aasmState || null,
                items: (box.items || []).map((item: any) => ({
                    sku: item.sku || null,
                    quantity: item.quantity ?? null,
                    weight: item.weight ?? null,
                    price: item.price ?? null,
                    description: item.description || null,
                })),
            })),

            carrierName: methodConfig?.shippingMethod?.carrier?.name || null,
            shippingMethodName: methodConfig?.shippingMethod?.name || null,

            warehouseName: order?.warehouse?.name || null,
            appName: order?.app?.name || null,

            rawResponse: responseBody,
        };
    }

    /**
     * Pretty-print the imported shipment verification results.
     */
    static logImportVerification(result: CoreImportVerification): void {
        console.log('');
        console.log('══════════════════════════════════════════════════════════════');
        console.log('  📋 CORE IMPORT VERIFICATION — Shipment Data in Xenvio');
        console.log('══════════════════════════════════════════════════════════════');

        // ── Shipment Info ─────────────────────────────────────────
        console.log(`  Shipment #         : ${result.shipmentNumber ?? 'N/A'}`);
        console.log(`  Order #            : ${result.orderNumber ?? 'N/A'}`);
        console.log(`  State              : ${result.aasmState ?? 'N/A'}`);
        console.log(`  Ship Code          : ${result.shippingMethodCode ?? 'N/A'}`);

        // ── Customer ──────────────────────────────────────────────
        console.log('');
        console.log('  👤 CUSTOMER');
        console.log(`     Name    : ${result.customerName ?? 'N/A'}`);
        console.log(`     Email   : ${result.customerEmail ?? 'N/A'}`);
        console.log(`     Phone   : ${result.customerPhone ?? 'N/A'}`);
        if (result.customerAddress) {
            const a = result.customerAddress;
            console.log(`     Address : ${a.address1 ?? 'N/A'}`);
            console.log(`               ${a.city ?? '?'}, ${a.state ?? '?'} ${a.zip ?? '?'}, ${a.country ?? '?'}`);
        }

        // ── Carrier / Method ──────────────────────────────────────
        console.log('');
        console.log('  🚚 CARRIER');
        console.log(`     Carrier Name   : ${result.carrierName ?? 'N/A'}`);
        console.log(`     Method Name    : ${result.shippingMethodName ?? 'N/A'}`);
        console.log(`     Ship Code      : ${result.shippingMethodCode ?? 'N/A'}`);

        // ── Warehouse / App ───────────────────────────────────────
        console.log('');
        console.log('  🏭 WAREHOUSE / APP');
        console.log(`     Warehouse : ${result.warehouseName ?? 'N/A'}`);
        console.log(`     App       : ${result.appName ?? 'N/A'}`);

        // ── Boxes Detail ──────────────────────────────────────────
        console.log('');
        console.log('  📦 BOXES');
        console.log('  ┌─────────┬────────────────────┬────────────┬───────┬──────────────────────────────┐');
        console.log('  │ Box     │ Dimensions (L×W×H)  │ Weight     │ Items │ SKUs                         │');
        console.log('  ├─────────┼────────────────────┼────────────┼───────┼──────────────────────────────┤');

        for (const box of result.boxes) {
            const dims = `${box.length}×${box.width}×${box.height}`;
            const weight = `${box.weight}`;
            const itemCount = box.items.length;
            const skus = box.items.map(it => `${it.sku}(qty:${it.quantity})`).join(', ');

            console.log(`  │ Box ${(box.boxNumber ?? '?').padEnd(3)} │ ${dims.padEnd(18)} │ ${weight.padEnd(10)} │ ${String(itemCount).padEnd(5)} │ ${skus.padEnd(28)} │`);
        }

        console.log('  └─────────┴────────────────────┴────────────┴───────┴──────────────────────────────┘');
        console.log('══════════════════════════════════════════════════════════════');
        console.log('');
    }
}
