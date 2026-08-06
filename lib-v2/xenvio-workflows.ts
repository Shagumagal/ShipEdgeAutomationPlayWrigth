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

            await orderToLabelPage.boxForm.clickApplyItem();
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
                await orderToLabelPage.boxForm.clickApplyItem();

                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for Xenvio loading spinner after adding the final item...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
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

                await orderToLabelPage.boxForm.clickApplyItem();

                if (boxNumber === boxesCount) {
                    await orderToLabelPage.waitForXenvioLoading(30000);
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
}
