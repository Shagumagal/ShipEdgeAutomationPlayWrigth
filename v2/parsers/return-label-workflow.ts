import { Locator, Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    injectReturnLabelInterceptor,
    readReturnLabelCapture,
    resetReturnLabelSlots,
    restoreReturnLabelInterceptor,
} from '../lib/network-capture';
import {
    describeReturnLabelError,
    isReturnLabelSettled,
    selectReturnLabelResponse,
    shouldRetryReturnLabel,
    type ReturnLabelCapture,
} from './return-label-parser';

/**
 * Upper bound for the success toast watcher: covers GET LABELS (90s) + first poll (30s)
 * + retry (≈2s + 10s + 60s loading + 60s poll). It resolves as soon as the toast shows.
 */
const SUCCESS_TOAST_WATCH_MS = 260000;
/** After the workflow ends, how long to keep waiting for a toast that has not appeared yet. */
const SUCCESS_TOAST_GRACE_MS = 5000;

/**
 * Screenshot a transient element (toast) the moment it becomes visible.
 * Never throws: returns null if it did not appear or the page closed.
 */
async function screenshotWhenVisible(locator: Locator, timeoutMs: number): Promise<Buffer | null> {
    try {
        await locator.waitFor({ state: 'visible', timeout: timeoutMs });
        return await locator.screenshot({ animations: 'disabled' });
    } catch {
        return null;
    }
}

/**
 * Click GET LABELS and capture both the main label and the automatic return label.
 * If the return label call fails with a RETRYABLE error (1008, see
 * RETRYABLE_RETURN_LABEL_CODES), retries once with "GET RETURN LABEL".
 * Any other error (e.g. carrier rejection 800000) is not retried: the spec
 * fails right away with the carrier message instead of waiting another minute.
 *
 * Browser orchestration only: every decision is delegated to return-label-parser.ts.
 * Timings are intentionally identical to the original inline implementation.
 */
export async function getLabelsWithReturnLabel(
    popupPage: Page,
    orderToLabelPage: XenvioOrderToLabelPage,
): Promise<ReturnLabelCapture> {
    return await allure.step('Capture Label + Return Label from Network', async () => {
        console.log('🔍 Setting up browser-side fetch interceptor for task_executor responses...');

        let mainLabelBody: any = null;
        let returnLabelBody: any = null;
        let returnLabelError: any = null;
        let initialReturnLabelError: any = null;
        let retried = false;

        await injectReturnLabelInterceptor(popupPage);

        // The toast lives only a few seconds, so it is watched in parallel from the start
        // and photographed the instant it appears (first attempt or after the retry).
        const successToastWatcher = screenshotWhenVisible(
            orderToLabelPage.returnLabelSuccessToast,
            SUCCESS_TOAST_WATCH_MS,
        );

        try {
            await orderToLabelPage.clickGetLabels(90000);
            console.log('✅ GET LABELS completed');

            // Poll for the automatic return_label call that follows the main label.
            console.log('⏳ Waiting for automatic return_label call...');
            const pollStart = Date.now();
            while (Date.now() - pollStart < 30000) {
                const captured = await readReturnLabelCapture(popupPage);
                mainLabelBody = captured.main;
                returnLabelBody = captured.returnLabel;
                returnLabelError = captured.returnError;

                if (isReturnLabelSettled(captured)) {
                    if (returnLabelBody) console.log('📡 task_executor?task=return_label — captured successfully');
                    if (returnLabelError) console.warn(`⚠️ Return label API error: ${JSON.stringify(returnLabelError)}`);
                    initialReturnLabelError = returnLabelError;
                    break;
                }
                await popupPage.waitForTimeout(1000);
            }

            if (mainLabelBody) console.log('📡 task_executor (main label) — captured');

            if (returnLabelError && !returnLabelBody && !shouldRetryReturnLabel(returnLabelBody, returnLabelError)) {
                console.error(
                    `❌ Return label failed with a non-retryable error: ${describeReturnLabelError(returnLabelError)} — not retrying`,
                );
            }

            if (shouldRetryReturnLabel(returnLabelBody, returnLabelError)) {
                retried = true;
                console.warn(`⚠️ Return label creation failed (retryable: ${describeReturnLabelError(returnLabelError)})`);
                console.log('🔄 Retrying via "GET RETURN LABEL" button...');

                await popupPage.waitForTimeout(2000);
                const getReturnBtn = orderToLabelPage.getReturnLabelButton;

                if (await getReturnBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
                    await resetReturnLabelSlots(popupPage);

                    await getReturnBtn.click();
                    console.log('✅ "GET RETURN LABEL" clicked');

                    await orderToLabelPage.waitForXenvioLoading(60000);

                    const retryStart = Date.now();
                    while (Date.now() - retryStart < 60000) {
                        const retry = await readReturnLabelCapture(popupPage);
                        if (retry.returnLabel) {
                            returnLabelBody = retry.returnLabel;
                            returnLabelError = null;
                            console.log('📡 Return label retry — captured successfully');
                            break;
                        }
                        if (retry.returnError) {
                            returnLabelError = retry.returnError;
                            console.error(`❌ Return label retry also failed: ${JSON.stringify(retry.returnError)}`);
                            break;
                        }
                        await popupPage.waitForTimeout(1000);
                    }
                } else {
                    console.warn('⚠️ "GET RETURN LABEL" button not visible — cannot retry');
                }
            }
        } finally {
            await restoreReturnLabelInterceptor(popupPage);
        }

        const responseBody = selectReturnLabelResponse(returnLabelBody, mainLabelBody);
        if (!responseBody) {
            console.error('❌ No task_executor response captured');
            throw new Error('Failed to capture any task_executor response');
        }

        console.log('📡 Final response captured — extracting return label data...');

        const successToastScreenshot = await Promise.race([
            successToastWatcher,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), SUCCESS_TOAST_GRACE_MS)),
        ]);
        if (successToastScreenshot) {
            console.log('📸 "Return label created successfully" toast captured');
        } else if (returnLabelBody) {
            console.warn('⚠️ Return label was created but its success toast was not seen — no toast evidence');
        }

        return {
            responseBody,
            mainLabelBody,
            returnLabelBody,
            returnLabelError,
            initialReturnLabelError,
            retried,
            successToastScreenshot,
        };
    });
}
