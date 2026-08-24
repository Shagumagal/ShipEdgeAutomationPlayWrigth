import { Page, expect } from '@playwright/test';
import * as allure from "allure-js-commons";
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { RecipientData, ProductDimensions, ReturnLabelData, InternationalItemData } from '../../lib/test-data';
import AllureHelper from '../../lib/allure-helper';
import { captureTaskExecutorResponse } from './network-capture';
import {
    getLabelsAndCaptureResult as _getLabelsAndCaptureResult,
    voidLabelAndCaptureResult as _voidLabelAndCaptureResult,
    logShipmentState as _logShipmentState,
    type GetLabelsResult,
    type VoidLabelResult,
} from './shipment-result-parser';

/**
 * Xenvio Shared Workflows (v2 — PrimeNG)
 *
 * Orchestrates business flows by composing page objects.
 * Network capture & result parsing are delegated to:
 *  - network-capture.ts   — fetch monkey-patch (single implementation)
 *  - shipment-result-parser.ts — label/void parsing & pretty logging
 */
export class XenvioWorkflows {

    // ═══════════════════════════════════════════════════════════════════
    // Login & Navigation
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // Order Creation
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // Item & Box Management
    // ═══════════════════════════════════════════════════════════════════

    static async addItemDetails(
        orderToLabelPage: XenvioOrderToLabelPage,
        item: ProductDimensions & { sku: string; country: string; unitPrice: string }
    ): Promise<void> {
        await allure.step('5. Add Item Details', async () => {
            await orderToLabelPage.boxForm.clickAddItem();
            await AllureHelper.attachScreenShot(orderToLabelPage.page);

            await orderToLabelPage.boxForm.fillItemDetails({
                ...item,
                qty: item.qty || '1',
            });

            const responseBody = await captureTaskExecutorResponse(
                orderToLabelPage.page,
                async () => {
                    await orderToLabelPage.boxForm.clickApplyItem();
                },
                60000
            );

            if (responseBody) {
                _logShipmentState(responseBody, item);
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
                    console.log('  📡 Capturing task_executor response for the final item...');
                    const responseBody = await captureTaskExecutorResponse(
                        popupPage,
                        async () => {
                            await orderToLabelPage.boxForm.clickApplyItem();
                        },
                        60000
                    );

                    if (responseBody) {
                        _logShipmentState(responseBody, pkg);
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
                    console.log('  📡 Capturing task_executor response for the final international item...');
                    const responseBody = await captureTaskExecutorResponse(
                        popupPage,
                        async () => {
                            await orderToLabelPage.boxForm.clickApplyItem();
                        },
                        60000
                    );

                    if (responseBody) {
                        _logShipmentState(responseBody);
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

    // ═══════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // Label Operations (delegated to shipment-result-parser.ts)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Click GET LABELS, capture the task_executor response, parse and log the result.
     * @see shipment-result-parser.ts for implementation details.
     */
    static async getLabelsAndCaptureResult(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs: number = 180000
    ): Promise<GetLabelsResult> {
        return _getLabelsAndCaptureResult(popupPage, orderToLabelPage, timeoutMs);
    }

    /**
     * Void a previously generated label and capture the void_label response.
     * @see shipment-result-parser.ts for implementation details.
     */
    static async voidLabelAndCaptureResult(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs: number = 120000
    ): Promise<VoidLabelResult> {
        return _voidLabelAndCaptureResult(popupPage, orderToLabelPage, timeoutMs);
    }

    /**
     * Log the full shipment state analysis from a task_executor response.
     * @see shipment-result-parser.ts for implementation details.
     */
    static logShipmentState(responseBody: any, expectedPkg?: ProductDimensions): void {
        _logShipmentState(responseBody, expectedPkg);
    }
}
