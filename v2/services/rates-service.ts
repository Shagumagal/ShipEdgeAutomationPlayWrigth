import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

/** Owns rate requests, selection and shipment confirmation. */
export class RatesService {
    static async request(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
    ): Promise<void> {
        await allure.step(`Get Rates`, async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage, 'Rates disponibles');
        });
    }

    static async selectFirstAndConfirm(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 60000,
    ): Promise<string> {
        return allure.step(`Select and Confirm Rate`, async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(timeoutMs);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await AllureHelper.addRunParameters({ Rate: selectedLabel });
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage, 'Rate seleccionado y confirmado');
            return selectedLabel;
        });
    }

    static async selectByTextAndConfirm(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        rateText: string,
    ): Promise<void> {
        await allure.step(`Select Rate and Save & Confirm`, async () => {
            await AllureHelper.addRunParameters({ Rate: rateText });
            await orderToLabelPage.ratesModal.selectRateByText(rateText);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage, 'Rate seleccionado y confirmado');
        });
    }
}
