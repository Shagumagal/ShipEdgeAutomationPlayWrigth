import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    injectFetchInterceptor,
    pollCapturedResponse,
    restoreFetch,
} from '../infrastructure/network-capture';
import { runTaskWithCarrierRetry } from './carrier-retry-runner';
import { logVoidLabelResult } from '../parsers/shipment-result-logger';
import { VoidLabelResult } from '../parsers/shipment-result-types';
import { parseVoidLabelResponse } from '../parsers/void-result-parser';

/**
 * Void a generated label, capture its response, parse it, and log the result.
 * A transient carrier error (e.g. "the USPS API did not return a valid response") is
 * retried once; any other failed response ends the step right away with its message.
 */
export async function voidLabelAndCaptureResult(
    popupPage: Page,
    orderToLabelPage: XenvioOrderToLabelPage,
    timeoutMs: number = 120000
): Promise<VoidLabelResult> {
    return await allure.step('Void Label and Capture Result from Network', async () => {
        console.log('\n🗑️  Starting VOID LABEL process...');
        console.log('🔍 Setting up browser-side fetch interceptor for task_executor (void_label)...');

        await injectFetchInterceptor(popupPage);

        let voidResponseBody: any = null;

        try {
            await runTaskWithCarrierRetry(popupPage, orderToLabelPage, 'void_label', 'VOID LABEL', {
                press: async () => {
                    await orderToLabelPage.clickVoidLabel();
                    await orderToLabelPage.clickConfirmVoidDialog();
                },
                waitForSuccess: () => orderToLabelPage.waitForVoidCompleted(timeoutMs),
            });

            console.log('⏳ Awaiting task_executor (void_label) response from browser...');
            voidResponseBody = await pollCapturedResponse(popupPage, timeoutMs, 1000);

            if (voidResponseBody) {
                console.log('📡 task_executor (void_label) response captured via browser fetch interceptor!');
            }
        } finally {
            await restoreFetch(popupPage);
        }

        const result = parseVoidLabelResponse(voidResponseBody);

        if (voidResponseBody) {
            logVoidLabelResult(result);
        } else {
            console.log('⚠️ Could not capture task_executor (void_label) response');
        }

        return result;
    });
}
