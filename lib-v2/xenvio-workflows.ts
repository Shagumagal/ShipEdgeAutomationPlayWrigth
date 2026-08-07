import { Page, expect } from '@playwright/test';
import * as allure from "allure-js-commons";
import { XenvioLoginPage } from '../page-objects-v2/xenvio-login-page';
import { XenvioDashboardPage } from '../page-objects-v2/xenvio-dashboard-page';
import { XenvioShipperViewPage } from '../page-objects-v2/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects-v2/xenvio-new-order-page';
import { XenvioOrderToLabelPage } from '../page-objects-v2/xenvio-order-to-label-page';
import { RecipientData, ProductDimensions, ReturnLabelData, InternationalItemData } from '../lib/test-data';
import AllureHelper from '../lib/allure-helper';

/**
 * Xenvio Shared Workflows (v2 — PrimeNG)
 *
 * Imports from page-objects-v2/ only.
 * Same business flows as the legacy workflows.
 */
export class XenvioWorkflows {

    static async loginAndOpenShipperView(
        xenvioLoginPage: XenvioLoginPage,
        xenvioDashboardPage: XenvioDashboardPage,
        config: { url: string; email: string; pass: string; warehouse: string; app: string }
    ): Promise<Page> {
        await allure.step('1. Login and Open Shipper View', async () => {
            await xenvioLoginPage.navigateToLogin(config.url);
            await xenvioLoginPage.login(config.email, config.pass);
        });

        const popupPage = await allure.step('2. Open Shipper View', async () => {
            const popup = await xenvioDashboardPage.openShipperView();
            return popup;
        });

        return popupPage;
    }

    static async createStandardOrder(
        popupPage: Page,
        recipient: RecipientData,
        pkg: ProductDimensions,
        warehouse: string
    ): Promise<string> {
        return await allure.step('3. Create New Order via UI', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            const shipmentNumber = await newOrderPage.createOrderFlow(recipient, pkg, warehouse);
            expect(shipmentNumber).not.toBeNull();
            return shipmentNumber!;
        });
    }

    /**
     * After order creation, the system automatically redirects to the shipment detail.
     * No searching needed — just wait for the page to be fully loaded and ready.
     */
    static async waitForShipmentDetailAfterCreation(
        popupPage: Page,
        shipmentNumber: string
    ): Promise<XenvioOrderToLabelPage> {
        return await allure.step('4. Wait for Shipment Detail (auto-redirect)', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.waitForShipmentDetailReady(30000);
            console.log(`✅ Shipment detail ready: ${shipmentNumber}`);
            await AllureHelper.attachScreenShot(popupPage);
            return orderToLabelPage;
        });
    }

    static async searchAndOpenShipment(
        popupPage: Page,
        shipmentNumber: string,
        config?: { warehouse: string; app: string }
    ): Promise<XenvioOrderToLabelPage> {
        return await allure.step('4. Search and Open Shipment Detail', async () => {
            const shipperView = new XenvioShipperViewPage(popupPage);

            // Warehouse/App selection is only needed when searching for an order
            if (config) {
                await shipperView.selectWarehouse(config.warehouse);
                await shipperView.selectApplication(config.app);
            }

            await shipperView.searchShipment(shipmentNumber);
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.clickShipmentRow(shipmentNumber);
            await orderToLabelPage.expandShipmentPanel(shipmentNumber);
            await AllureHelper.attachScreenShot(popupPage);
            return orderToLabelPage;
        });
    }

    static async addItemDetails(
        orderToLabelPage: XenvioOrderToLabelPage,
        item: ProductDimensions & { sku: string; country: string; unitPrice: string }
    ): Promise<void> {
        await allure.step('5. Add Item Details', async () => {
            // Click "+ Add Item" on the existing box
            await orderToLabelPage.boxForm.clickAddItem();
            await AllureHelper.attachScreenShot(orderToLabelPage.page);

            // Fill the item form in the modal
            await orderToLabelPage.boxForm.fillItemDetails({
                ...item,
                qty: item.qty || '1',
            });

            // Capture task_executor response when applying
            const responseBody = await this.captureTaskExecutorResponse(
                orderToLabelPage.page,
                async () => {
                    await orderToLabelPage.boxForm.clickApplyItem();
                },
                60000
            );

            if (responseBody) {
                this.logShipmentState(responseBody, item);
                await AllureHelper.attachJSON(orderToLabelPage.page, 'Shipment State After Item', responseBody);
            }

            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }


    static async setupDomesticMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        pkg: ProductDimensions,
        stepPrefix = '5'
    ): Promise<void> {
        await allure.step(`${stepPrefix}a. Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, pkg.weight, pkg.length, pkg.width, pkg.height);
                await orderToLabelPage.boxForm.clickApplyBox();

                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for Xenvio loading spinner after the final box creation...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes created`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step(`${stepPrefix}b. Add Items to all ${boxesCount} Boxes (SKU 1-${boxesCount})`, async () => {
            for (let i = 1; i <= boxesCount; i++) {
                console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);
                await orderToLabelPage.waitForXenvioLoading(15000);

                await orderToLabelPage.boxForm.clickAddItemForBox(i - 1);
                await orderToLabelPage.boxForm.fillItemDetails({
                    sku:       `${i}`,
                    weight:    pkg.weight,
                    length:    pkg.length,
                    width:     pkg.width,
                    height:    pkg.height,
                    country:   'us',
                    unitPrice: '1',
                    qty:       pkg.qty
                });

                if (i === boxesCount) {
                    // Last item: capture and analyze the task_executor response
                    console.log('  📡 Capturing task_executor response for the final item...');
                    const responseBody = await this.captureTaskExecutorResponse(
                        popupPage,
                        async () => {
                            await orderToLabelPage.boxForm.clickApplyItem();
                        },
                        60000
                    );

                    if (responseBody) {
                        this.logShipmentState(responseBody, pkg);
                        await AllureHelper.attachJSON(popupPage, 'Shipment State After All Items', responseBody);
                    }
                } else {
                    await orderToLabelPage.boxForm.clickApplyItem();
                }
            }
            console.log(`✅ All ${boxesCount} items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }


    static async setupInternationalMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        item: InternationalItemData,
        boxWeight = '5',
        stepPrefix = '6'
    ): Promise<void> {
        await allure.step(`${stepPrefix}a. Create ${boxesCount - 1} additional boxes (2–${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, boxWeight, item.length, item.width, item.height);
                await orderToLabelPage.boxForm.clickApplyBox();

                if (i === boxesCount) {
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes ready`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step(`${stepPrefix}b. Add international item to each of the ${boxesCount} boxes`, async () => {
            for (let i = 0; i < boxesCount; i++) {
                const boxNumber = i + 1;
                const sku = `intl-sku-${boxNumber}`;

                console.log(`  📝 Adding international item to Box #${boxNumber} (SKU: ${sku})...`);
                await orderToLabelPage.waitForXenvioLoading(15000);

                await orderToLabelPage.boxForm.clickAddItemForBox(i);
                await AllureHelper.attachScreenShot(popupPage);

                await orderToLabelPage.boxForm.fillInternationalItemDetails({
                    sku,
                    weight:            item.weight,
                    length:            item.length,
                    width:             item.width,
                    height:            item.height,
                    itemDescription:   item.itemDescription,
                    harmonizationCode: item.harmonizationCode,
                    countryOfOrigin:   item.countryOfOrigin,
                    unitPrice:         item.unitPrice,
                    qty:               item.qty,
                });

                if (boxNumber === boxesCount) {
                    // Last item: capture and analyze the task_executor response
                    console.log('  📡 Capturing task_executor response for the final international item...');
                    const responseBody = await this.captureTaskExecutorResponse(
                        popupPage,
                        async () => {
                            await orderToLabelPage.boxForm.clickApplyItem();
                        },
                        60000
                    );

                    if (responseBody) {
                        this.logShipmentState(responseBody);
                        await AllureHelper.attachJSON(popupPage, 'Shipment State After All Intl Items', responseBody);
                    }
                } else {
                    await orderToLabelPage.boxForm.clickApplyItem();
                }

                console.log(`  ✅ Box #${boxNumber} — international item applied`);
            }

            console.log(`✅ All ${boxesCount} international items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    static async configureReturnLabel(
        orderToLabelPage: XenvioOrderToLabelPage,
        returnLabelData: ReturnLabelData
    ): Promise<void> {
        await allure.step('6. Configure Return Label', async () => {
            await orderToLabelPage.configPanel.configureReturnLabel(returnLabelData);
            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }

    /**
     * Configure a specific Ship Code in the Configure Shipment panel.
     * Useful for multibox orders that need a carrier supporting multibox (e.g. EUSEM).
     *
     * @param orderToLabelPage - The O2L page object
     * @param shipCode         - Ship code to select (e.g. 'EUSEM')
     */
    static async configureShipCode(
        orderToLabelPage: XenvioOrderToLabelPage,
        shipCode: string
    ): Promise<void> {
        await allure.step(`Configure Ship Code: ${shipCode}`, async () => {
            console.log(`📋 Configuring Ship Code: ${shipCode}...`);
            await orderToLabelPage.configPanel.selectShipCode(shipCode);
            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }


    static async getLabelsAndCaptureResult(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs: number = 180000
    ): Promise<{
        finalPostage: number | null;
        shippingCost: number | null;
        labelUrls: string[];
        docUrls: string[];
        labelsByBox: { boxIndex: number; label: string; returnLabel?: string }[];
    }> {
        return await allure.step('Capture Label Result from Network/UI', async () => {
            console.log('🔍 Setting up network interceptor for task_executor API...');

            // Use event listener instead of waitForResponse to capture the body
            // immediately when it arrives — avoids CDP buffer eviction (Protocol error)
            let labelResponseBody: any = null;
            let captureResolve: () => void;
            const capturePromise = new Promise<void>((resolve) => { captureResolve = resolve; });

            const responseHandler = async (response: import('@playwright/test').Response) => {
                try {
                    if (
                        response.url().includes('task_executor') &&
                        response.status() === 200
                    ) {
                        // Read the body IMMEDIATELY when the response event fires
                        const body = await response.body();
                        labelResponseBody = JSON.parse(body.toString());
                        console.log('📡 task_executor response captured immediately via event listener!');
                        captureResolve();
                    }
                } catch (err) {
                    console.warn('⚠️ Error capturing task_executor body in event listener:', err);
                }
            };

            popupPage.on('response', responseHandler);

            try {
                await orderToLabelPage.clickGetLabels(timeoutMs);

                console.log('⏳ Awaiting task_executor network response...');

                // Wait for capture or timeout
                await Promise.race([
                    capturePromise,
                    popupPage.waitForTimeout(timeoutMs)
                ]);
            } finally {
                // Always remove the listener
                popupPage.removeListener('response', responseHandler);
            }

            if (labelResponseBody) {
                console.log('📡 task_executor response successfully captured from network!');
            } else {
                console.log('⚠️ Could not capture task_executor API response via event listener');
            }

            console.log('⏳ Extra wait — allowing UI/documents to fully render...');
            await popupPage.waitForTimeout(5000);

            let finalPostage: number | null = null;
            let shippingCost: number | null = null;
            let labelUrls: string[] = [];
            let docUrls: string[] = [];
            const labelsByBox: { boxIndex: number; label: string; returnLabel?: string }[] = [];

            if (labelResponseBody) {
                const shipment = labelResponseBody?.shipments?.[0];
                if (shipment) {
                    finalPostage = typeof shipment.finalPostage === 'number' ? shipment.finalPostage : null;
                    shippingCost = typeof shipment.shippingCost === 'number' ? shipment.shippingCost : null;

                    if (shipment.boxes) {
                        shipment.boxes.forEach((box: any, idx: number) => {
                            labelsByBox.push({
                                boxIndex: idx + 1,
                                label: box.label || '',
                                returnLabel: box.returnLabel || undefined
                            });
                            if (box.label) labelUrls.push(box.label);
                            if (box.returnLabel) labelUrls.push(box.returnLabel);
                        });
                    }
                }

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
                console.log('\n══════════════════════════════════════════════');
                console.log('  📦 LABEL TASK RESULT (CAPTURED FROM NETWORK)');
                console.log('══════════════════════════════════════════════');
                console.log(`  💰 finalPostage  : ${finalPostage ?? 'N/A'}`);
                console.log(`  💳 shippingCost  : ${shippingCost ?? 'N/A'}`);

                // ── Price breakdown: rate quoted vs actual charged ────
                const shipmentData = labelResponseBody?.shipments?.[0];
                if (shipmentData?.rates) {
                    const selectedRate = shipmentData.rates.find?.(
                        (r: any) => r.id === shipmentData.requestedBestRateId || r.selected
                    );
                    if (selectedRate?.rate && finalPostage !== null) {
                        const quoted = parseFloat(selectedRate.rate);
                        const actual = finalPostage;
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


                if (labelsByBox.length > 0) {
                    console.log('\n  🏷️  LABEL URL(s) BY BOX — CMD+Click to open:');
                    labelsByBox.forEach((b) => {
                        console.log(`     [Box ${b.boxIndex}] Label: ${b.label}`);
                        if (b.returnLabel) {
                            console.log(`     [Box ${b.boxIndex}] Return: ${b.returnLabel}`);
                        }
                    });
                }

                if (docUrls.length > 0) {
                    console.log('\n  📄  DOCUMENT URL(s) — CMD+Click to open:');
                    docUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
                }
                console.log('══════════════════════════════════════════════\n');
            }

            return { finalPostage, shippingCost, labelUrls, docUrls, labelsByBox };
        });
    }

    /**
     * Intercept the task_executor response while executing an async action.
     * Uses page.on('response') event listener + immediate body capture
     * to avoid CDP buffer eviction (Protocol error: No data found).
     *
     * @param popupPage - The Playwright page (Shipper View popup)
     * @param action    - Async callback that triggers the API call (e.g. clickApplyItem)
     * @param timeoutMs - Max wait for the response (default: 60s)
     * @returns The parsed JSON body, or null if capture fails
     */
    private static async captureTaskExecutorResponse(
        popupPage: Page,
        action: () => Promise<void>,
        timeoutMs = 60000
    ): Promise<any | null> {
        let capturedBody: any = null;
        let captureResolve: () => void;
        const capturePromise = new Promise<void>((resolve) => { captureResolve = resolve; });

        // 1. Setup event listener BEFORE the action — captures body immediately
        const responseHandler = async (response: import('@playwright/test').Response) => {
            try {
                if (
                    response.url().includes('task_executor') &&
                    response.status() === 200
                ) {
                    const body = await response.body();
                    capturedBody = JSON.parse(body.toString());
                    console.log('📡 task_executor response captured via event listener');
                    captureResolve();
                }
            } catch (err) {
                console.warn('⚠️ Error reading task_executor body in listener:', err);
            }
        };

        popupPage.on('response', responseHandler);

        try {
            // 2. Execute the action (e.g. click Apply Item)
            await action();

            // 3. Wait for capture or timeout
            await Promise.race([
                capturePromise,
                popupPage.waitForTimeout(timeoutMs)
            ]);
        } finally {
            popupPage.removeListener('response', responseHandler);
        }

        if (capturedBody) {
            console.log('📡 task_executor response captured after item apply');
        } else {
            console.warn('⚠️ Could not capture task_executor response (timeout or error)');
        }

        return capturedBody;
    }

    /**
     * Analyze and log the full shipment state from a task_executor response.
     * Validates box dimensions, weights, items, customer data, and carrier config.
     *
     * @param responseBody    - Raw JSON from the task_executor API
     * @param expectedPkg     - The dimensions we expect all boxes to have (for consistency check)
     */
    static logShipmentState(
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
}
