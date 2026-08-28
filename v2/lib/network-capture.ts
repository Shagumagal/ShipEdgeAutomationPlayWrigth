import { Page } from '@playwright/test';

/**
 * Network Capture Utility
 *
 * Browser-side fetch monkey-patch pattern for intercepting API responses.
 * Immune to CDP buffer eviction — works in popup windows.
 *
 * Provides two strategies:
 *  1. Single-response capture  → injectFetchInterceptor / pollCapturedResponse / restoreFetch
 *     Used for: task_executor (one response expected)
 *
 *  2. Multi-response capture   → injectMultiResponseInterceptor / pollCapturedResponses / restoreMultiFetch
 *     Used for: search_by_warehouse (fired twice on import; captures all, pick richest)
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

// ═══════════════════════════════════════════════════════════════════════════════
// Generic multi-response interceptor (for endpoints called multiple times,
// e.g. search_by_warehouse which fires twice: once for carriers, once for import)
// ═══════════════════════════════════════════════════════════════════════════════

// Window keys for the multi-capture variant (separate namespace from task_executor)
const MULTI_CAPTURE_KEY = '__xenvio_captured_responses_array';
const MULTI_ORIG_FETCH_KEY = '__xenvio_orig_fetch_multi';

/**
 * Inject a fetch interceptor that captures ALL successful responses from
 * URLs matching `urlPattern` into an array on `window`.
 *
 * Use this when the target endpoint is called more than once and you need
 * to inspect all responses (e.g. search_by_warehouse fires twice).
 *
 * Call this BEFORE the action that triggers the API calls.
 *
 * @param page       - The Playwright page (popup or main)
 * @param urlPattern - Substring to match in the request URL (e.g. 'search_by_warehouse')
 */
export async function injectMultiResponseInterceptor(page: Page, urlPattern: string): Promise<void> {
    await page.evaluate(({ arrayKey, origFetchKey, pattern }) => {
        const origFetch = window.fetch;
        (window as any)[origFetchKey] = origFetch;
        (window as any)[arrayKey] = [];

        window.fetch = async function (...args: any[]) {
            const response = await origFetch.apply(this, args as any);
            try {
                const url = (args[0] instanceof Request ? args[0].url : String(args[0])) || '';
                if (url.includes(pattern) && response.ok) {
                    const clone = response.clone();
                    const body = await clone.json();
                    (window as any)[arrayKey].push(body);
                }
            } catch { /* ignore parse/clone errors */ }
            return response;
        };
    }, { arrayKey: MULTI_CAPTURE_KEY, origFetchKey: MULTI_ORIG_FETCH_KEY, pattern: urlPattern });
}

/**
 * Poll the browser context for ALL captured responses accumulated so far.
 * Keeps polling until `minCount` responses are captured or `timeoutMs` elapses.
 *
 * @param page      - The Playwright page
 * @param timeoutMs - Maximum wait time in milliseconds
 * @param minCount  - Stop early when at least this many responses are captured (default: 1)
 * @param pollMs    - Polling interval (default: 500ms)
 * @returns Array of all captured response bodies (may be empty on timeout)
 */
export async function pollCapturedResponses(
    page: Page,
    timeoutMs: number,
    minCount = 1,
    pollMs = 500
): Promise<any[]> {
    const pollStart = Date.now();
    while (Date.now() - pollStart < timeoutMs) {
        const results: any[] = await page.evaluate(
            (key) => (window as any)[key] ?? [],
            MULTI_CAPTURE_KEY
        );
        if (results.length >= minCount) {
            return results;
        }
        await page.waitForTimeout(pollMs);
    }
    // Return whatever was captured before timeout
    return await page.evaluate(
        (key) => (window as any)[key] ?? [],
        MULTI_CAPTURE_KEY
    );
}

/**
 * Restore the original fetch and clean up multi-capture window keys.
 * Safe to call even if the page has navigated or closed.
 *
 * @param page - The Playwright page
 */
export async function restoreMultiFetch(page: Page): Promise<void> {
    await page.evaluate(({ arrayKey, origFetchKey }) => {
        if ((window as any)[origFetchKey]) {
            window.fetch = (window as any)[origFetchKey];
        }
        delete (window as any)[arrayKey];
        delete (window as any)[origFetchKey];
    }, { arrayKey: MULTI_CAPTURE_KEY, origFetchKey: MULTI_ORIG_FETCH_KEY })
        .catch(() => { /* page might be closed */ });
}
