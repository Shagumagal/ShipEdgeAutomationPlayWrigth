import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { ReturnLabelData } from "../test-data";
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

/** Owns optional shipment configuration before rating or label generation. */
export class ShipmentConfigurationService {
    static async configureReturnLabel(
        orderToLabelPage: XenvioOrderToLabelPage,
        returnLabelData: ReturnLabelData,
    ): Promise<void> {
        await allure.step('Configure Return Label', async () => {
            await orderToLabelPage.configPanel.configureReturnLabel(returnLabelData);
            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }

    static async configureShipCode(
        orderToLabelPage: XenvioOrderToLabelPage,
        shipCode: string,
    ): Promise<void> {
        await allure.step(`Configure Ship Code: ${shipCode}`, async () => {
            console.log(`📋 Configuring Ship Code: ${shipCode}...`);
            await orderToLabelPage.configPanel.selectShipCode(shipCode);
            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }
}
