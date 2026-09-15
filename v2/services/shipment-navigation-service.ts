import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';

export interface ShipmentSearchContext {
    warehouse: string;
    app: string;
}

/** Owns UI navigation to shipment detail; it does not create order data. */
export class ShipmentNavigationService {
    static async waitForDetailAfterCreation(
        popupPage: Page,
        shipmentNumber: string,
    ): Promise<XenvioOrderToLabelPage> {
        return allure.step('4. Wait for Shipment Detail (auto-redirect)', async () => {
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.waitForShipmentDetailReady(30000);
            console.log(`✅ Shipment detail ready: ${shipmentNumber}`);
            await AllureHelper.attachScreenShot(popupPage);
            return orderToLabelPage;
        });
    }

    static async searchAndOpen(
        popupPage: Page,
        shipmentNumber: string,
        context?: ShipmentSearchContext,
    ): Promise<XenvioOrderToLabelPage> {
        return allure.step('4. Search and Open Shipment Detail', async () => {
            const shipperView = new XenvioShipperViewPage(popupPage);

            if (context) {
                await shipperView.selectWarehouse(context.warehouse);
                await shipperView.selectApplication(context.app);
            }

            await shipperView.searchShipment(shipmentNumber);
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.clickShipmentRow(shipmentNumber);
            await orderToLabelPage.expandShipmentPanel(shipmentNumber);
            await AllureHelper.attachScreenShot(popupPage);
            return orderToLabelPage;
        });
    }
}
