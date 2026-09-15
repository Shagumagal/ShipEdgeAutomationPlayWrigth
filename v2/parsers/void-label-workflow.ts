import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    injectFetchInterceptor,
    pollCapturedResponse,
    restoreFetch,
} from '../lib/network-capture';
import { logVoidLabelResult } from './shipment-result-logger';
import { VoidLabelResult } from './shipment-result-types';
import { parseVoidLabelResponse } from './void-result-parser';

/** Void a generated label, capture its response, parse it, and log the result. */
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
            await orderToLabelPage.clickVoidLabel();
            await orderToLabelPage.confirmVoidLabelDialog(timeoutMs);

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
