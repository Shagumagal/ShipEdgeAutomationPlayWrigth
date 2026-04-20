import { Page, expect } from '@playwright/test';
import * as allure from "allure-js-commons";
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { RecipientData, ProductDimensions } from './test-data';
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
}
