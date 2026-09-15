import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

/** Owns rate requests, selection and shipment confirmation. */
export class RatesService {
    static async request(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        step = '6',
    ): Promise<void> {
        await allure.step(`${step}. Get Rates`, async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    static async selectFirstAndConfirm(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 60000,
        step = '7',
    ): Promise<string> {
        return allure.step(`${step}. Select and Confirm Rate`, async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(timeoutMs);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
            return selectedLabel;
        });
    }

    static async selectByTextAndConfirm(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        rateText: string,
        step = '7',
    ): Promise<void> {
        await allure.step(`${step}. Select Rate and Save & Confirm`, async () => {
            await orderToLabelPage.ratesModal.selectRateByText(rateText);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });
    }
}
