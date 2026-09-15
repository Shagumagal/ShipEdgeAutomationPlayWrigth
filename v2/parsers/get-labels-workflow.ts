import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    injectFetchInterceptor,
    pollCapturedResponse,
    restoreFetch,
} from '../lib/network-capture';
import { parseGetLabelsResponse } from './label-result-parser';
import { logGetLabelsResult } from './shipment-result-logger';
import { GetLabelsResult, LabelsByBox } from './shipment-result-types';

/** Click GET LABELS, capture its response, parse it, and fall back to the UI when needed. */
export async function getLabelsAndCaptureResult(
    popupPage: Page,
    orderToLabelPage: XenvioOrderToLabelPage,
    timeoutMs: number = 180000
): Promise<GetLabelsResult> {
    return await allure.step('Capture Label Result from Network/UI', async () => {
        console.log('🔍 Setting up browser-side fetch interceptor for task_executor API...');

        await injectFetchInterceptor(popupPage);

        let labelResponseBody: any = null;

        try {
            await orderToLabelPage.clickGetLabels(timeoutMs);

            console.log('⏳ Awaiting task_executor response from browser...');
            labelResponseBody = await pollCapturedResponse(popupPage, timeoutMs, 1000);

            if (labelResponseBody) {
                console.log('📡 task_executor response captured via browser fetch interceptor!');
            }
        } finally {
            await restoreFetch(popupPage);
        }

        if (labelResponseBody) {
            console.log('📡 task_executor response successfully captured from network!');
        } else {
            console.log('⚠️ Could not capture task_executor API response via event listener');
        }

        console.log('⏳ Extra wait — allowing UI/documents to fully render...');
        await popupPage.waitForTimeout(5000);

        const parsedResult = parseGetLabelsResponse(labelResponseBody);
        let {
            finalPostage,
            shippingCost,
            labelUrls,
            docUrls,
            labelsByBox,
        } = parsedResult;
        const { shipmentState, orderNumber, shipmentNumber } = parsedResult;

        if (finalPostage === null && shippingCost === null && labelsByBox.length === 0) {
            console.log('⚠️ Network capture was empty. Falling back to UI-based scrape...');
            const uiResult = await orderToLabelPage.captureTaskLabelResult();
            finalPostage = uiResult.finalPostage;
            shippingCost = uiResult.shippingCost;
            labelUrls = uiResult.labelUrls;
            docUrls = uiResult.docUrls;
            labelsByBox = labelUrls.map((url, index): LabelsByBox => ({
                boxIndex: index + 1,
                label: url,
            }));
        } else {
            logGetLabelsResult(
                {
                    finalPostage,
                    shippingCost,
                    labelUrls,
                    docUrls,
                    labelsByBox,
                    shipmentState,
                    orderNumber,
                    shipmentNumber,
                },
                labelResponseBody
            );
        }

        return {
            finalPostage,
            shippingCost,
            labelUrls,
            docUrls,
            labelsByBox,
            shipmentState,
            orderNumber,
            shipmentNumber,
        };
    });
}
