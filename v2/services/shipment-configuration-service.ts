import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { ReturnLabelData } from '../../lib/test-data';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

/** Owns optional shipment configuration before rating or label generation. */
export class ShipmentConfigurationService {
    static async configureReturnLabel(
        orderToLabelPage: XenvioOrderToLabelPage,
        returnLabelData: ReturnLabelData,
    ): Promise<void> {
        await allure.step('6. Configure Return Label', async () => {
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
