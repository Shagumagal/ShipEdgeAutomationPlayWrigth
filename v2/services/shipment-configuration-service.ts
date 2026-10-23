import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { ReturnLabelData } from "../test-data";
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { describeTaskError } from '../domain/carriers/carrier-errors';
import { captureTaskResult } from '../infrastructure/network-capture';
import type { InternationalSettings } from '../domain/shipments/international-settings';

/** Owns optional shipment configuration before rating or label generation. */
export class ShipmentConfigurationService {
    static async configureReturnLabel(
        orderToLabelPage: XenvioOrderToLabelPage,
        returnLabelData: ReturnLabelData,
    ): Promise<void> {
        await allure.step('Configure Return Label', async () => {
            await orderToLabelPage.configPanel.configureReturnLabel(returnLabelData);
            await AllureHelper.attachScreenShot(orderToLabelPage.page, 'Return label configured');
        });
    }

    static async configureShipCode(
        orderToLabelPage: XenvioOrderToLabelPage,
        shipCode: string,
    ): Promise<void> {
        await allure.step(`Configure Ship Code: ${shipCode}`, async () => {
            console.log(`📋 Configuring Ship Code: ${shipCode}...`);
            await orderToLabelPage.configPanel.selectShipCode(shipCode);
            await AllureHelper.attachScreenShot(orderToLabelPage.page, `Ship code ${shipCode} configured`);
        });
    }

    /**
     * Fill International Settings and SAVE & CONFIRM. Returns the shipment Xenvio answered with
     * (task_executor `shipments[0]`), so the caller can check what was really stored; fails when
     * no answer arrives or it is about another shipment. `taxIdCarrier` is the carrier group of the
     * Tax ID Type list (e.g. "USPS").
     */
    static async configureInternationalSettings(
        orderToLabelPage: XenvioOrderToLabelPage,
        settings: InternationalSettings,
        taxIdCarrier: string,
    ): Promise<any> {
        return allure.step('Configure International Settings and Save & Confirm', async () => {
            await orderToLabelPage.internationalSettings.fill(settings, taxIdCarrier);
            await AllureHelper.attachLocatorScreenshot(orderToLabelPage.internationalSettings.region, 'International Settings filled');

            const result = await captureTaskResult(orderToLabelPage.page, () => orderToLabelPage.clickSaveAndConfirm());
            if (!result) {
                throw new Error('International Settings not saved: Xenvio did not answer SAVE & CONFIRM (task_executor) within 60s');
            }
            if (!result.ok) {
                throw new Error(`International Settings not saved: Xenvio rejected SAVE & CONFIRM (HTTP ${result.error.status}): ${describeTaskError(result.error.error)}`);
            }

            const saved = result.body.shipments?.[0];
            const expectedShipment = orderToLabelPage.shipmentNumber;
            if (saved?.shipmentNumber !== expectedShipment) {
                throw new Error(`International Settings not saved: the answer is about shipment ${saved?.shipmentNumber ?? 'none'}, expected ${expectedShipment}`);
            }

            await AllureHelper.attachJSON(orderToLabelPage.page, 'Saved International Settings', {
                shipmentType: saved.shipmentType,
                currencyIsoCode: saved.currencyIsoCode,
                services: saved.services,
            });
            return saved;
        });
    }
}
