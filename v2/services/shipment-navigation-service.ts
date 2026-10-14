import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { shipperViewUrl, type ShipperViewTarget } from '../domain/shipments/shipper-view-link';

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
        return allure.step('Wait for Shipment Detail (auto-redirect)', async () => {
            await AllureHelper.addRunParameters({ Shipment: shipmentNumber });
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.waitForShipmentDetailReady(30000);
            console.log(`✅ Shipment detail ready: ${shipmentNumber}`);
            await AllureHelper.attachScreenShot(popupPage, 'Shipment detail');
            return orderToLabelPage;
        });
    }

    /** Opens a shipment straight from its URL, e.g. one created through the API. */
    static async openByUrl(popupPage: Page, target: ShipperViewTarget): Promise<XenvioOrderToLabelPage> {
        return allure.step(`Open Shipment ${target.shipmentNumber}`, async () => {
            await AllureHelper.addRunParameters({ Shipment: target.shipmentNumber });
            await popupPage.goto(shipperViewUrl(new URL(popupPage.url()).origin, target));
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.waitForShipmentOpened(30000);
            console.log(`✅ Shipment detail ready: ${target.shipmentNumber}`);
            await AllureHelper.attachScreenShot(popupPage, 'Shipment detail');
            return orderToLabelPage;
        });
    }

    static async searchAndOpen(
        popupPage: Page,
        shipmentNumber: string,
        context?: ShipmentSearchContext,
    ): Promise<XenvioOrderToLabelPage> {
        return allure.step('Search and Open Shipment Detail', async () => {
            await AllureHelper.addRunParameters({ Shipment: shipmentNumber });
            const shipperView = new XenvioShipperViewPage(popupPage);

            if (context) {
                await shipperView.selectWarehouse(context.warehouse);
                await shipperView.selectApplication(context.app);
            }

            await shipperView.searchShipment(shipmentNumber);
            const orderToLabelPage = new XenvioOrderToLabelPage(popupPage);
            await orderToLabelPage.clickShipmentRow(shipmentNumber);
            await orderToLabelPage.expandShipmentPanel(shipmentNumber);
            await AllureHelper.attachScreenShot(popupPage, 'Shipment detail opened');
            return orderToLabelPage;
        });
    }
}
