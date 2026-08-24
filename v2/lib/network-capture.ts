import { Page } from '@playwright/test';

/**
 * Network Capture Utility
 *
 * Single source of truth for the browser-side fetch monkey-patch pattern
 * used to intercept task_executor API responses.
 *
 * This pattern is immune to CDP buffer eviction and works in popup windows.
 *
 * Previously this code was duplicated 3 times in xenvio-workflows.ts:
 *  - captureTaskExecutorResponse (for addItemDetails)
 *  - inline in getLabelsAndCaptureResult
 *  - inline in voidLabelAndCaptureResult
 */

// Unique keys used in the browser's window object to avoid collisions
const CAPTURE_KEY = '__xenvio_captured_response';
const ORIG_FETCH_KEY = '__xenvio_orig_fetch';

/**
 * Inject a fetch interceptor into the browser context that captures
 * the first successful task_executor response.
 *
 * Call this BEFORE the action that triggers the API call.
 *
 * @param page - The Playwright page (popup or main)
 */
export async function injectFetchInterceptor(page: Page): Promise<void> {
    await page.evaluate(({ captureKey, origFetchKey }) => {
        const origFetch = window.fetch;
        (window as any)[origFetchKey] = origFetch;
        (window as any)[captureKey] = null;

        window.fetch = async function (...args: any[]) {
            const response = await origFetch.apply(this, args as any);
            try {
                const url = (args[0] instanceof Request ? args[0].url : String(args[0])) || '';
                if (url.includes('task_executor') && response.ok) {
                    const clone = response.clone();
                    const body = await clone.json();
                    (window as any)[captureKey] = body;
                }
            } catch { /* ignore parse errors */ }
            return response;
        };
    }, { captureKey: CAPTURE_KEY, origFetchKey: ORIG_FETCH_KEY });
}

/**
 * Poll the browser context for the captured task_executor response.
 *
 * @param page      - The Playwright page
 * @param timeoutMs - Maximum wait time in milliseconds
 * @param pollMs    - Polling interval in milliseconds (default: 500)
 * @returns The parsed JSON body, or null if capture timed out
 */
export async function pollCapturedResponse(
    page: Page,
    timeoutMs: number,
    pollMs = 500
): Promise<any | null> {
    const pollStart = Date.now();
    while (Date.now() - pollStart < timeoutMs) {
        const result = await page.evaluate(
            (key) => (window as any)[key],
            CAPTURE_KEY
        );
        if (result) {
            return result;
        }
        await page.waitForTimeout(pollMs);
    }
    return null;
}

/**
 * Restore the original fetch function and clean up the captured data.
 * Safe to call even if the page has navigated or closed.
 *
 * @param page - The Playwright page
 */
export async function restoreFetch(page: Page): Promise<void> {
    await page.evaluate(({ captureKey, origFetchKey }) => {
        if ((window as any)[origFetchKey]) {
            window.fetch = (window as any)[origFetchKey];
        }
        delete (window as any)[captureKey];
        delete (window as any)[origFetchKey];
    }, { captureKey: CAPTURE_KEY, origFetchKey: ORIG_FETCH_KEY })
        .catch(() => { /* page might be closed or navigated */ });
}

/**
 * High-level helper: inject interceptor → execute action → poll → cleanup.
 *
 * Used by addItemDetails and similar workflows that need to capture the
 * task_executor response while performing a UI action.
 *
 * @param page      - The Playwright page
 * @param action    - Async callback that triggers the API call (e.g. clickApplyItem)
 * @param timeoutMs - Max wait for the response (default: 60s)
 * @returns The parsed JSON body, or null if capture fails
 */
export async function captureTaskExecutorResponse(
    page: Page,
    action: () => Promise<void>,
    timeoutMs = 60000
): Promise<any | null> {
    await injectFetchInterceptor(page);

    let capturedBody: any = null;

    try {
        await action();

        capturedBody = await pollCapturedResponse(page, timeoutMs);

        if (capturedBody) {
            console.log('📡 task_executor response captured via browser fetch interceptor');
        } else {
            console.warn('⚠️ Could not capture task_executor response (timeout — non-critical)');
        }
    } finally {
        await restoreFetch(page);
    }

    return capturedBody;
}
