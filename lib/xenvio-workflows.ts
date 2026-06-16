import { Page, expect } from '@playwright/test';
import * as allure from "allure-js-commons";
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { RecipientData, ProductDimensions, ReturnLabelData, InternationalItemData } from './test-data';
import AllureHelper from './allure-helper';

/**
 * Xenvio Shared Workflows
 * 
 * Centralized logic for common multi-page processes to avoid code duplication in specs.
 */
export class XenvioWorkflows {
    
    /**
     * Complete login flow and environment selection.
     * Returns the Shipper View popup page.
     */
    static async loginAndOpenShipperView(
        xenvioLoginPage: XenvioLoginPage,
        xenvioDashboardPage: XenvioDashboardPage,
        config: { url: string; email: string; pass: string; warehouse: string; app: string }
    ): Promise<Page> {
        await allure.step('1. Login and Open Shipper View', async () => {
            await xenvioLoginPage.navigateToLogin(config.url);
            await xenvioLoginPage.login(config.email, config.pass);
        });

        const popupPage = await allure.step('2. Select Environment in Shipper View', async () => {
            const popup = await xenvioDashboardPage.openShipperView();
            const shipperViewPage = new XenvioShipperViewPage(popup);
            await shipperViewPage.selectWarehouse(config.warehouse);
            await shipperViewPage.selectApplication(config.app);
            return popup;
        });

        return popupPage;
    }

    /**
     * Standard order creation through the Shipper View UI.
     */
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
     * Search and Open a shipment in the O2L detail panel.
     */
    static async searchAndOpenShipment(
        popupPage: Page,
        shipmentNumber: string
    ): Promise<XenvioOrderToLabelPage> {
        return await allure.step('4. Search and Open Shipment Detail', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            const shipperView = new XenvioShipperViewPage(popupPage);
            await shipperView.searchShipment(shipmentNumber);
            await orderToLabelPage.clickShipmentRow(shipmentNumber);
            await orderToLabelPage.expandShipmentPanel(shipmentNumber);
            await AllureHelper.attachScreenShot(popupPage);
            return orderToLabelPage;
        });
    }

     /**
     * Add item details to the shipment.
     */
    static async addItemDetails(
        orderToLabelPage: XenvioOrderToLabelPage,
        item: ProductDimensions & { sku: string; country: string; unitPrice: string }
    ): Promise<void> {
        await allure.step('5. Add Item Details', async () => {
            await orderToLabelPage.boxForm.clickAddItem();
            
            // Add Screenshot of the form before filling
            await AllureHelper.attachScreenShot(orderToLabelPage.page);

            await orderToLabelPage.boxForm.fillBoxForm('1', item.weight, item.length, item.width, item.height);
            await orderToLabelPage.boxForm.selectCountry(item.country);
            
            await orderToLabelPage.boxForm.fillItemDetails({
                ...item,
                qty: item.qty || '1'
            });

            await orderToLabelPage.boxForm.clickApplyItem();
            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }

    /**
     * Creates additional boxes (2..N) and adds a domestic item to each box.
     * Box 1 is assumed to already exist from the New Order flow.
     *
     * @param popupPage       - The Shipper View popup page (for screenshots).
     * @param orderToLabelPage - The O2L page object.
     * @param boxesCount      - Total number of boxes including the first one.
     * @param pkg             - Package dimensions used for each box and item.
     * @param stepPrefix      - Optional prefix for step labels (e.g. '5a', '6a').
     */
    static async setupDomesticMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        pkg: ProductDimensions,
        stepPrefix = '5'
    ): Promise<void> {
        // Step A: Create additional boxes (box 1 already exists)
        await allure.step(`${stepPrefix}a. Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, pkg.weight, pkg.length, pkg.width, pkg.height);
                await orderToLabelPage.boxForm.clickApplyBox();

                // Wait for the loading spinner after the final box is created
                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for Xenvio loading spinner after the final box creation...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes created`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // Step B: Add one domestic item per box
        await allure.step(`${stepPrefix}b. Add Items to all ${boxesCount} Boxes (SKU 1-${boxesCount})`, async () => {
            for (let i = 1; i <= boxesCount; i++) {
                console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);

                // Wait for spinner to clear before interacting with the Add Item button
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
                await orderToLabelPage.boxForm.clickApplyItem();

                // Wait for the loading spinner after the final item is added
                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for Xenvio loading spinner after adding the final item...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    /**
     * Creates additional boxes (2..N) and adds an international item to each box.
     * Box 1 is assumed to already exist from the New Order flow.
     *
     * @param popupPage        - The Shipper View popup page (for screenshots).
     * @param orderToLabelPage  - The O2L page object.
     * @param boxesCount       - Total number of boxes including the first one.
     * @param item             - International item data (customs fields included).
     * @param boxWeight        - Physical box weight (separate from commodity weight).
     * @param stepPrefix       - Optional prefix for step labels (e.g. '5a', '6a').
     */
    static async setupInternationalMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        item: InternationalItemData,
        boxWeight = '5',
        stepPrefix = '6'
    ): Promise<void> {
        // Step A: Create additional boxes (box 1 already exists)
        await allure.step(`${stepPrefix}a. Create ${boxesCount - 1} additional boxes (2–${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, boxWeight, item.length, item.width, item.height);
                await orderToLabelPage.boxForm.clickApplyBox();

                // Wait for the loading spinner after the last additional box
                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for loading spinner after last box creation...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes ready`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // Step B: Add one international item per box
        await allure.step(`${stepPrefix}b. Add international item to each of the ${boxesCount} boxes`, async () => {
            for (let i = 0; i < boxesCount; i++) {
                const boxNumber = i + 1;
                const sku       = `intl-sku-${boxNumber}`;

                console.log(`  📝 Adding international item to Box #${boxNumber} (SKU: ${sku})...`);

                // Wait for the loading spinner and any stale forms to clear
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

                await orderToLabelPage.boxForm.clickApplyItem();

                // Wait for the full loading cycle after the last box item
                if (boxNumber === boxesCount) {
                    console.log('  ⏳ Waiting for loading spinner after last item...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }

                console.log(`  ✅ Box #${boxNumber} — international item applied`);
            }

            console.log(`✅ All ${boxesCount} international items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    /**
     * Configure return label in the Configure Shipment panel.
     * Enables "Include return label", fills the return label form, 
     * selects carrier + ship code, and confirms.
     */
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
     * Executes the Get Labels flow and intercepts the task_executor API response.
     * Extracts and returns finalPostage, shippingCost, label URLs per box, and document URLs.
     */
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
            
            // Interceptor must be registered BEFORE the button click
            const labelResponsePromise = popupPage.waitForResponse(
                (response) =>
                    response.url().includes('task_executor') &&
                    response.status() === 200,
                { timeout: timeoutMs }
            );

            await orderToLabelPage.clickGetLabels(timeoutMs);

            console.log('⏳ Awaiting task_executor network response...');
            let labelResponseBody: any = null;
            try {
                const labelResponse = await labelResponsePromise;
                labelResponseBody = await labelResponse.json();
                console.log('📡 task_executor response successfully captured from network!');
            } catch (err) {
                console.log('⚠️ Could not intercept task_executor API response:', err);
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

                // Sweep the full JSON string for any other PDFs (e.g. Commercial Invoices)
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

            // Fallback to UI-based capture if network capture was empty
            if (finalPostage === null && shippingCost === null && labelsByBox.length === 0) {
                console.log('⚠️ Network capture was empty. Falling back to UI-based scrape...');
                const uiResult = await orderToLabelPage.captureTaskLabelResult();
                finalPostage = uiResult.finalPostage;
                shippingCost = uiResult.shippingCost;
                labelUrls = uiResult.labelUrls;
                docUrls = uiResult.docUrls;
                
                // Construct fallback labelsByBox from the scraped labelUrls
                labelUrls.forEach((url, i) => {
                    labelsByBox.push({
                        boxIndex: i + 1,
                        label: url
                    });
                });
            } else {
                // Print formatted summary to console
                console.log('\n══════════════════════════════════════════════');
                console.log('  📦 LABEL TASK RESULT (CAPTURED FROM NETWORK)');
                console.log('══════════════════════════════════════════════');
                console.log(`  💰 finalPostage  : ${finalPostage ?? 'N/A'}`);
                console.log(`  💳 shippingCost  : ${shippingCost ?? 'N/A'}`);

                if (labelsByBox.length > 0) {
                    console.log('\n  🏷️  LABEL URL(s) BY BOX — CMD+Click to open:');
                    labelsByBox.forEach((b) => {
                        console.log(`     [Box ${b.boxIndex}] Label: ${b.label}`);
                        if (b.returnLabel) {
                            console.log(`     [Box ${b.boxIndex}] Return: ${b.returnLabel}`);
                        }
                    });
                } else if (labelUrls.length > 0) {
                    console.log('\n  🏷️  LABEL URL(s) — CMD+Click to open:');
                    labelUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
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
}
