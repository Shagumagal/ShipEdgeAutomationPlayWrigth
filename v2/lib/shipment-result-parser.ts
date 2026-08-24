import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { ProductDimensions } from '../../lib/test-data';
import AllureHelper from '../../lib/allure-helper';
import {
    injectFetchInterceptor,
    pollCapturedResponse,
    restoreFetch,
} from './network-capture';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface LabelsByBox {
    boxIndex: number;
    label: string;
    returnLabel?: string;
    trackingNumber?: string;
    state?: string;
}

export interface GetLabelsResult {
    finalPostage: number | null;
    shippingCost: number | null;
    labelUrls: string[];
    docUrls: string[];
    labelsByBox: LabelsByBox[];
    shipmentState: string | null;
    orderNumber: string | null;
    shipmentNumber: string | null;
}

export interface BoxVoidState {
    boxIndex: number;
    state: string | null;
    trackingNumber: string | null;
    labelState: string | null;
}

export interface VoidLabelResult {
    shipmentState: string | null;
    labelState: string | null;
    shipmentNumber: string | null;
    orderNumber: string | null;
    boxesVoidState: BoxVoidState[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Get Labels — capture & parse
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Click GET LABELS, capture the task_executor response from the network,
 * parse the shipment/boxes/labels data, and log a detailed summary.
 *
 * Falls back to UI-based scraping if network capture fails.
 */
export async function getLabelsAndCaptureResult(
    popupPage: Page,
    orderToLabelPage: XenvioOrderToLabelPage,
    timeoutMs: number = 180000
): Promise<GetLabelsResult> {
    return await allure.step('Capture Label Result from Network/UI', async () => {
        console.log('🔍 Setting up browser-side fetch interceptor for task_executor API...');

        await injectFetchInterceptor(popupPage);

        let labelResponseBody: any = null;

        try {
            await orderToLabelPage.clickGetLabels(timeoutMs);

            console.log('⏳ Awaiting task_executor response from browser...');
            labelResponseBody = await pollCapturedResponse(popupPage, timeoutMs, 1000);

            if (labelResponseBody) {
                console.log('📡 task_executor response captured via browser fetch interceptor!');
            }
        } finally {
            await restoreFetch(popupPage);
        }

        if (labelResponseBody) {
            console.log('📡 task_executor response successfully captured from network!');
        } else {
            console.log('⚠️ Could not capture task_executor API response via event listener');
        }

        console.log('⏳ Extra wait — allowing UI/documents to fully render...');
        await popupPage.waitForTimeout(5000);

        // ── Parse response ───────────────────────────────────────────
        let finalPostage: number | null = null;
        let shippingCost: number | null = null;
        let labelUrls: string[] = [];
        let docUrls: string[] = [];
        const labelsByBox: LabelsByBox[] = [];
        let shipmentState: string | null = null;
        let orderNumber: string | null = null;
        let shipmentNumber: string | null = null;

        if (labelResponseBody) {
            const shipment = labelResponseBody?.shipments?.[0];
            if (shipment) {
                finalPostage = typeof shipment.finalPostage === 'number' ? shipment.finalPostage : null;
                shippingCost = typeof shipment.shippingCost === 'number' ? shipment.shippingCost : null;
                shipmentState = shipment.aasmState || null;
                shipmentNumber = shipment.shipmentNumber || null;
                orderNumber = shipment.order?.orderNumber || null;

                if (shipment.boxes) {
                    shipment.boxes.forEach((box: any, idx: number) => {
                        labelsByBox.push({
                            boxIndex: idx + 1,
                            label: box.label || '',
                            returnLabel: box.returnLabel || undefined,
                            trackingNumber: box.trackingNumber || box.tracking_number || undefined,
                            state: box.aasmState || box.aasm_state || undefined,
                        });
                        if (box.label) labelUrls.push(box.label);
                        if (box.returnLabel) labelUrls.push(box.returnLabel);
                    });
                }
            }

            // Extract additional PDF/document URLs from the full JSON
            try {
                const jsonStr = JSON.stringify(labelResponseBody);
                const pdfMatches = [...jsonStr.matchAll(/https?:\/\/[^\s"]+\.pdf[^\s"]*/gi)];
                for (const m of pdfMatches) {
                    const url = m[0].replace(/[",]/g, '').trim();
                    if (url.toLowerCase().includes('invoice') || url.toLowerCase().includes('commercial')) {
                        if (!docUrls.includes(url)) docUrls.push(url);
                    } else {
                        if (!labelUrls.includes(url) && !labelsByBox.some(b => b.label === url || b.returnLabel === url)) {
                            labelUrls.push(url);
                        }
                    }
                }
            } catch {
                console.log('⚠️ Failed to extract extra document URLs from JSON string');
            }
        }

        // ── Fallback to UI scraping ──────────────────────────────────
        if (finalPostage === null && shippingCost === null && labelsByBox.length === 0) {
            console.log('⚠️ Network capture was empty. Falling back to UI-based scrape...');
            const uiResult = await orderToLabelPage.captureTaskLabelResult();
            finalPostage = uiResult.finalPostage;
            shippingCost = uiResult.shippingCost;
            labelUrls = uiResult.labelUrls;
            docUrls = uiResult.docUrls;

            labelUrls.forEach((url, i) => {
                labelsByBox.push({ boxIndex: i + 1, label: url });
            });
        } else {
            logGetLabelsResult({ finalPostage, shippingCost, labelUrls, docUrls, labelsByBox, shipmentState, orderNumber, shipmentNumber }, labelResponseBody);
        }

        return { finalPostage, shippingCost, labelUrls, docUrls, labelsByBox, shipmentState, orderNumber, shipmentNumber };
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Void Label — capture & parse
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Void a previously generated label and capture the task_executor (void_label) response.
 *
 * Flow:
 *  1. Inject browser-side fetch interceptor
 *  2. Click "VOID SHIPPING LABELS"
 *  3. Confirm the "Delete Shipment Label" dialog
 *  4. Capture the void_label response from the network
 *  5. Log and return shipment state, label state, and per-box voided states
 */
export async function voidLabelAndCaptureResult(
    popupPage: Page,
    orderToLabelPage: XenvioOrderToLabelPage,
    timeoutMs: number = 120000
): Promise<VoidLabelResult> {
    return await allure.step('Void Label and Capture Result from Network', async () => {
        console.log('\n🗑️  Starting VOID LABEL process...');
        console.log('🔍 Setting up browser-side fetch interceptor for task_executor (void_label)...');

        await injectFetchInterceptor(popupPage);

        let voidResponseBody: any = null;

        try {
            await orderToLabelPage.clickVoidLabel();
            await orderToLabelPage.confirmVoidLabelDialog(timeoutMs);

            console.log('⏳ Awaiting task_executor (void_label) response from browser...');
            voidResponseBody = await pollCapturedResponse(popupPage, timeoutMs, 1000);

            if (voidResponseBody) {
                console.log('📡 task_executor (void_label) response captured via browser fetch interceptor!');
            }
        } finally {
            await restoreFetch(popupPage);
        }

        // ── Parse void result ────────────────────────────────────────
        let shipmentState: string | null = null;
        let labelState: string | null = null;  // from box.labelState (not on shipment level)
        let shipmentNumber: string | null = null;
        let orderNumber: string | null = null;
        const boxesVoidState: BoxVoidState[] = [];

        if (voidResponseBody) {
            const shipment = voidResponseBody?.shipments?.[0];
            if (shipment) {
                shipmentState = shipment.aasmState || shipment.aasm_state || null;
                shipmentNumber = shipment.shipmentNumber || shipment.shipment_number || null;
                orderNumber = shipment.order?.orderNumber || shipment.order?.order_number || null;

                if (shipment.boxes) {
                    shipment.boxes.forEach((box: any, idx: number) => {
                        const boxLabelState = box.labelState || box.label_state || null;
                        if (idx === 0) labelState = boxLabelState;
                        boxesVoidState.push({
                            boxIndex: idx + 1,
                            state: box.aasmState || box.aasm_state || null,
                            trackingNumber: box.trackingNumber || box.tracking_number || null,
                            labelState: boxLabelState,
                        });
                    });
                }
            }

            logVoidLabelResult({ shipmentState, labelState, shipmentNumber, orderNumber, boxesVoidState });
        } else {
            console.log('⚠️ Could not capture task_executor (void_label) response');
        }

        return { shipmentState, labelState, shipmentNumber, orderNumber, boxesVoidState };
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
// Shipment State Logger (for addItemDetails / setupMultiBox)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze and log the full shipment state from a task_executor response.
 * Validates box dimensions, weights, items, customer data, and carrier config.
 */
export function logShipmentState(
    responseBody: any,
    expectedPkg?: ProductDimensions
): void {
    const shipment = responseBody?.shipments?.[0];
    if (!shipment) {
        console.warn('⚠️ No shipment data found in task_executor response');
        return;
    }

    const boxes = shipment.boxes || [];
    const customer = shipment.customer;
    const order = shipment.order;
    const methodConfig = shipment.shippingMethodConfig;

    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  📦 SHIPMENT STATE ANALYSIS (task_executor)');
    console.log('══════════════════════════════════════════════════════════════');

    // ── Shipment Info ─────────────────────────────────────────────
    console.log(`  Shipment #    : ${shipment.shipmentNumber}`);
    console.log(`  State         : ${shipment.aasmState}`);
    console.log(`  Type          : ${shipment.shipmentType}`);
    console.log(`  Final Postage : ${shipment.finalPostage ?? 'N/A'}`);
    console.log(`  Shipping Cost : ${shipment.shippingCost ?? 'N/A'}`);

    // ── Customer Info ─────────────────────────────────────────────
    if (customer) {
        console.log('');
        console.log('  👤 CUSTOMER');
        console.log(`     Name    : ${customer.name}`);
        console.log(`     Company : ${customer.company}`);
        console.log(`     Email   : ${customer.email}`);
        console.log(`     Phone   : ${customer.phone}`);
        if (customer.address) {
            const a = customer.address;
            console.log(`     Address : ${a.address1}${a.address2 ? ', ' + a.address2 : ''}`);
            console.log(`               ${a.city}, ${a.state} ${a.zip}, ${a.country}`);
            if (a.meta?.addressError) {
                console.warn(`     ⚠️ Address Error: ${a.meta.addressError}`);
            }
        }
    }

    // ── Carrier / Method Config ───────────────────────────────────
    if (methodConfig) {
        console.log('');
        console.log('  🚚 CARRIER CONFIG');
        console.log(`     Ship Code      : ${methodConfig.clientCode}`);
        console.log(`     Method          : ${methodConfig.shippingMethod?.name ?? 'N/A'}`);
        console.log(`     Carrier         : ${methodConfig.shippingMethod?.carrier?.name ?? 'N/A'}`);
        console.log(`     Carrier Account : ${methodConfig.carrierAccount?.name ?? 'N/A'} (id: ${methodConfig.carrierAccountId})`);
        console.log(`     Multibox        : ${methodConfig.shippingMethod?.carrier?.multibox ?? 'N/A'}`);
    }

    // ── Order Info ────────────────────────────────────────────────
    if (order) {
        console.log('');
        console.log('  📋 ORDER');
        console.log(`     Order #    : ${order.orderNumber}`);
        console.log(`     Boxes Qty  : ${order.shipments?.[0]?.boxesQuantity ?? 'N/A'}`);
        console.log(`     Items Qty  : ${order.shipments?.[0]?.itemsQuantity ?? 'N/A'}`);
        console.log(`     Warehouse  : ${order.warehouse?.name ?? 'N/A'}`);
    }

    // ── Boxes Detail ──────────────────────────────────────────────
    console.log('');
    console.log('  📦 BOXES DETAIL');
    console.log('  ┌─────────┬────────────────────┬────────────┬───────┬──────────────────────────────┐');
    console.log('  │ Box     │ Dimensions (L×W×H)  │ Weight     │ Items │ SKUs                         │');
    console.log('  ├─────────┼────────────────────┼────────────┼───────┼──────────────────────────────┤');

    let hasWarnings = false;

    for (let idx = 0; idx < boxes.length; idx++) {
        const box = boxes[idx];
        const dims = `${box.length}×${box.width}×${box.height}`;
        const weight = `${box.weight} lbs`;
        const itemCount = box.items?.length ?? 0;
        const skus = (box.items || []).map((it: any) => `${it.sku}(qty:${it.quantity})`).join(', ');

        console.log(`  │ Box ${idx + 1}   │ ${dims.padEnd(18)} │ ${weight.padEnd(10)} │ ${String(itemCount).padEnd(5)} │ ${skus.padEnd(28)} │`);

        // Check items inside this box
        for (const item of (box.items || [])) {
            const itemDims = `${item.length}×${item.width}×${item.height}`;
            if (expectedPkg) {
                const expectedDims = `${parseFloat(expectedPkg.length)}×${parseFloat(expectedPkg.width)}×${parseFloat(expectedPkg.height)}`;
                if (itemDims !== expectedDims) {
                    console.warn(`  │  ⚠️ Item ${item.sku}: dims ${itemDims} ≠ expected ${expectedDims}`);
                    hasWarnings = true;
                }
                const expectedWeight = parseFloat(expectedPkg.weight);
                if (item.weight !== expectedWeight) {
                    console.warn(`  │  ⚠️ Item ${item.sku}: weight ${item.weight} ≠ expected ${expectedWeight}`);
                    hasWarnings = true;
                }
            }
        }
    }

    console.log('  └─────────┴────────────────────┴────────────┴───────┴──────────────────────────────┘');

    // ── Cross-box dimension consistency check ─────────────────────
    if (boxes.length > 1) {
        const boxDimsSet = new Set(boxes.map((b: any) => `${b.length}×${b.width}×${b.height}`));
        const boxWeightSet = new Set(boxes.map((b: any) => `${b.weight}`));

        if (boxDimsSet.size > 1) {
            console.warn('');
            console.warn('  ⚠️ BOX DIMENSION MISMATCH — boxes have different dimensions:');
            boxes.forEach((b: any, i: number) => {
                console.warn(`     Box ${i + 1}: ${b.length}×${b.width}×${b.height} in, ${b.weight} lbs`);
            });
            console.warn('  → This may cause "rate not available" errors at buy time');
            hasWarnings = true;
        } else {
            console.log('  ✅ All boxes have consistent dimensions');
        }

        if (boxWeightSet.size > 1) {
            console.warn('  ⚠️ BOX WEIGHT MISMATCH — boxes have different weights');
            hasWarnings = true;
        } else {
            console.log('  ✅ All boxes have consistent weights');
        }
    }

    if (!hasWarnings) {
        console.log('  ✅ All data validated — no discrepancies found');
    }

    console.log('══════════════════════════════════════════════════════════════');
    console.log('');
}


// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-print helpers (internal)
// ═══════════════════════════════════════════════════════════════════════════════

function logGetLabelsResult(result: GetLabelsResult, rawResponse: any): void {
    console.log('\n══════════════════════════════════════════════');
    console.log('  📦 LABEL TASK RESULT (CAPTURED FROM NETWORK)');
    console.log('══════════════════════════════════════════════');
    console.log(`  📋 Order #       : ${result.orderNumber ?? 'N/A'}`);
    console.log(`  📋 Shipment #    : ${result.shipmentNumber ?? 'N/A'}`);
    console.log(`  🚦 Shipment State: ${result.shipmentState ?? 'N/A'}`);
    console.log(`  💰 finalPostage  : ${result.finalPostage ?? 'N/A'}`);
    console.log(`  💳 shippingCost  : ${result.shippingCost ?? 'N/A'}`);

    // ── Price breakdown: rate quoted vs actual charged ────
    const shipmentData = rawResponse?.shipments?.[0];
    if (shipmentData?.rates) {
        const selectedRate = shipmentData.rates.find?.(
            (r: any) => r.id === shipmentData.requestedBestRateId || r.selected
        );
        if (selectedRate?.rate && result.finalPostage !== null) {
            const quoted = parseFloat(selectedRate.rate);
            const actual = result.finalPostage;
            const diff = actual - quoted;
            if (Math.abs(diff) > 0.001) {
                console.log(`\n  ⚠️ PRICE DIFFERENCE DETECTED:`);
                console.log(`     Quoted at GET RATES : $${quoted.toFixed(2)}`);
                console.log(`     Final charged       : $${actual.toFixed(2)}`);
                console.log(`     Difference          : $${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
                console.log(`     → Possible causes: carrier surcharge, multibox per-piece fee, residential fee`);
            } else {
                console.log(`  ✅ Price consistent: $${actual.toFixed(2)}`);
            }
        }
    }

    // ── Per-box tracking, state, and label URLs ───────────
    if (result.labelsByBox.length > 0) {
        console.log('\n  📦 BOXES DETAIL — Tracking & Labels:');
        console.log('  ┌─────────┬──────────────────────────┬────────────┬──────────────────────────────┐');
        console.log('  │ Box     │ Tracking Number          │ State      │ Label URL                    │');
        console.log('  ├─────────┼──────────────────────────┼────────────┼──────────────────────────────┤');
        result.labelsByBox.forEach((b) => {
            const tracking = (b.trackingNumber || 'N/A').padEnd(24);
            const state = (b.state || 'N/A').padEnd(10);
            const labelShort = b.label ? b.label.substring(b.label.lastIndexOf('/') + 1).substring(0, 28) : 'N/A';
            console.log(`  │ Box ${b.boxIndex}   │ ${tracking} │ ${state} │ ${labelShort.padEnd(28)} │`);
        });
        console.log('  └─────────┴──────────────────────────┴────────────┴──────────────────────────────┘');

        console.log('\n  🏷️  LABEL URL(s) BY BOX — CMD+Click to open:');
        result.labelsByBox.forEach((b) => {
            console.log(`     [Box ${b.boxIndex}] Tracking: ${b.trackingNumber || 'N/A'}`);
            console.log(`     [Box ${b.boxIndex}] Label: ${b.label}`);
            if (b.returnLabel) {
                console.log(`     [Box ${b.boxIndex}] Return: ${b.returnLabel}`);
            }
        });
    }

    if (result.docUrls.length > 0) {
        console.log('\n  📄  DOCUMENT URL(s) — CMD+Click to open:');
        result.docUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
    }
    console.log('══════════════════════════════════════════════\n');
}

function logVoidLabelResult(result: VoidLabelResult): void {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  🗑️  VOID LABEL RESULT (task_executor — void_label)');
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`  📋 Order #       : ${result.orderNumber ?? 'N/A'}`);
    console.log(`  📋 Shipment #    : ${result.shipmentNumber ?? 'N/A'}`);
    console.log(`  🚦 Shipment State: ${result.shipmentState ?? 'N/A'}`);
    console.log(`  🏷️  Label State   : ${result.labelState ?? 'N/A'}`);

    if (result.boxesVoidState.length > 0) {
        console.log('\n  📦 BOXES VOID STATUS:');
        console.log('  ┌─────────┬──────────────────────────┬────────────┬────────────┐');
        console.log('  │ Box     │ Tracking Number          │ State      │ LabelState │');
        console.log('  ├─────────┼──────────────────────────┼────────────┼────────────┤');
        result.boxesVoidState.forEach((b) => {
            const tracking = (b.trackingNumber || 'N/A').padEnd(24);
            const state = (b.state || 'N/A').padEnd(10);
            const lblState = (b.labelState || 'N/A').padEnd(10);
            console.log(`  │ Box ${b.boxIndex}   │ ${tracking} │ ${state} │ ${lblState} │`);
        });
        console.log('  └─────────┴──────────────────────────┴────────────┴────────────┘');
    }

    console.log('══════════════════════════════════════════════════════════════\n');
}
