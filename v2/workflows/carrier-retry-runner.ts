import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { describeTaskError, type XenvioTaskError } from '../domain/carriers/carrier-errors';
import { TRANSIENT_RETRY_DELAY_MS, decideCarrierRetry } from '../domain/carriers/carrier-retry-policy';
import { readCapturedTaskError, resetCapturedTaskError } from '../infrastructure/network-capture';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

/** How often the failed-response slot is checked while the UI wait runs. */
const TASK_ERROR_POLL_MS = 1000;

export interface RetryableTaskAction {
    /** Triggers the task (click). Must not wait for the result. */
    press: () => Promise<void>;
    /** The original UI wait for success (e.g. VOID button visible after GET LABELS). */
    waitForSuccess: () => Promise<void>;
}

export interface RetryableTaskResult {
    retries: number;
    /** The first transient error that was retried, if any. */
    initialError: XenvioTaskError | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs the original UI wait while watching for a failed task_executor response of `task`.
 * Returns as soon as either happens, so a carrier error no longer means waiting for the
 * full UI timeout. The UI wait keeps its exact behavior; if the task fails first it is left
 * running in the background with its rejection handled.
 */
async function waitForSuccessOrTaskError(
    page: Page,
    task: string,
    waitForSuccess: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; error: XenvioTaskError }> {
    let settled = false;
    let failure: unknown = null;
    const success = waitForSuccess().then(
        () => { settled = true; },
        (error) => { settled = true; failure = error ?? new Error('UI wait failed'); },
    );

    while (!settled) {
        const error = await readCapturedTaskError(page, task);
        if (error) return { ok: false, error };
        await Promise.race([success, sleep(TASK_ERROR_POLL_MS)]);
    }

    if (failure) {
        // The UI wait failed; if the task itself failed, that is the real cause.
        const error = await readCapturedTaskError(page, task);
        if (error) return { ok: false, error };
        throw failure;
    }
    return { ok: true };
}

/**
 * Presses a Xenvio task and waits for it, retrying ONLY for transient carrier errors
 * (see domain/carriers/carrier-retry-policy.ts). Each retry is recorded as an Allure step.
 * Any other failed response ends the step right away with the carrier/Xenvio message
 * instead of waiting for the UI timeout.
 *
 * Requires injectFetchInterceptor to be active on `page`.
 */
export async function runTaskWithCarrierRetry(
    page: Page,
    orderToLabelPage: XenvioOrderToLabelPage,
    task: string,
    actionName: string,
    action: RetryableTaskAction,
): Promise<RetryableTaskResult> {
    let retries = 0;
    let initialError: XenvioTaskError | null = null;

    for (;;) {
        await resetCapturedTaskError(page);
        await action.press();

        const outcome = await waitForSuccessOrTaskError(page, task, action.waitForSuccess);
        if (outcome.ok) {
            if (retries > 0) console.log(`✅ ${actionName} succeeded after ${retries} retry(ies)`);
            return { retries, initialError };
        }

        const message = describeTaskError(outcome.error.error);
        const decision = decideCarrierRetry(outcome.error.error, retries);

        if (!decision.retry) {
            throw new Error(
                `${actionName} failed — task_executor?task=${task} answered HTTP ${outcome.error.status}: ${message} `
                + `(${decision.reason})`,
            );
        }

        retries++;
        initialError ??= outcome.error;
        console.warn(`⚠️ ${actionName}: ${message} — ${decision.reason}. Retrying in ${TRANSIENT_RETRY_DELAY_MS / 1000}s...`);

        await allure.step(`Retry ${actionName} after transient carrier error (${retries})`, async () => {
            await allure.attachment('Transient carrier error', JSON.stringify(outcome.error, null, 2), 'application/json');
        });

        await orderToLabelPage.dismissErrorToasts();
        await sleep(TRANSIENT_RETRY_DELAY_MS);
    }
}
