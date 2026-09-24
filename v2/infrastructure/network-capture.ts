import { Page } from '@playwright/test';
import type { XenvioTaskError } from '../domain/carriers/carrier-errors';

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
const ERROR_KEY = '__xenvio_captured_task_error';


/**
 * Inject a fetch interceptor into the browser context that captures
 * the first successful task_executor response.
 *
 * A response counts as successful only when its HTTP status is ok AND its body has no
 * `error`: Xenvio can answer 2xx with `{ error }` (the return-label flow relies on that
 * contract), and such a body must never reach the parsers as if it were a label.
 * Failed responses are kept apart (see readCapturedTaskError) and never satisfy the
 * successful capture.
 *
 * Call this BEFORE the action that triggers the API call.
 *
 * @param page - The Playwright page (popup or main)
 */
export async function injectFetchInterceptor(page: Page): Promise<void> {
    await page.evaluate(({ captureKey, origFetchKey, errorKey }) => {
        const origFetch = window.fetch;
        (window as any)[origFetchKey] = origFetch;
        (window as any)[captureKey] = null;
        (window as any)[errorKey] = null;

        window.fetch = async function (...args: any[]) {
            const response = await origFetch.apply(this, args as any);
            try {
                const url = (args[0] instanceof Request ? args[0].url : String(args[0])) || '';
                if (url.includes('task_executor')) {
                    const body = await response.clone().json().catch(() => null);
                    // An `error` in the body is a failure even with a 2xx status.
                    const bodyError = body && typeof body === 'object' ? body.error : null;

                    if (response.ok && !bodyError) {
                        if (body) (window as any)[captureKey] = body;
                    } else {
                        (window as any)[errorKey] = {
                            task: new URL(url, window.location.href).searchParams.get('task'),
                            status: response.status,
                            error: bodyError ?? body,
                        };
                    }
                }
            } catch { /* ignore parse errors */ }
            return response;
        };
    }, { captureKey: CAPTURE_KEY, origFetchKey: ORIG_FETCH_KEY, errorKey: ERROR_KEY });
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
    await page.evaluate(({ captureKey, origFetchKey, errorKey }) => {
        if ((window as any)[origFetchKey]) {
            window.fetch = (window as any)[origFetchKey];
        }
        delete (window as any)[captureKey];
        delete (window as any)[origFetchKey];
        delete (window as any)[errorKey];
    }, { captureKey: CAPTURE_KEY, origFetchKey: ORIG_FETCH_KEY, errorKey: ERROR_KEY })
        .catch(() => { /* page might be closed or navigated */ });
}

/**
 * Last failed task_executor response captured by injectFetchInterceptor, optionally
 * only for one task (e.g. 'label', 'void_label'). Null when there is none or the page closed.
 */
export async function readCapturedTaskError(page: Page, task?: string): Promise<XenvioTaskError | null> {
    const captured = await page.evaluate((key) => (window as any)[key] ?? null, ERROR_KEY)
        .catch(() => null) as XenvioTaskError | null;
    if (!captured) return null;
    return !task || captured.task === task ? captured : null;
}

/** Clears the failed-response slot (call before retrying an action). */
export async function resetCapturedTaskError(page: Page): Promise<void> {
    await page.evaluate((key) => { (window as any)[key] = null; }, ERROR_KEY)
        .catch(() => { /* page might be closed */ });
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

// ─── Strategy 3: GET LABELS + automatic return_label ──────────────────────────
//
// GET LABELS fires two task_executor calls: the main label and, when a return
// label is configured, a follow-up `task=return_label`. The single-response
// interceptor above keeps only the first one, so this flow classifies each
// response into its own slot. The window keys are the same ones the return
// label spec used before this was extracted, so browser behavior is unchanged.

const RL_ORIG_FETCH_KEY = '__origFetchRL';
const RL_MAIN_KEY = '__capturedMainLabel';
const RL_RETURN_KEY = '__capturedReturnLabel';
const RL_ERROR_KEY = '__capturedReturnLabelError';

/** Snapshot of the return-label interceptor slots. */
export interface ReturnLabelInterceptorSnapshot {
    main: any | null;
    returnLabel: any | null;
    returnError: any | null;
}

/**
 * Inject a fetch interceptor that sorts task_executor responses into
 * main label / return label / return label error.
 * Call BEFORE clicking GET LABELS; always pair with restoreReturnLabelInterceptor.
 */
export async function injectReturnLabelInterceptor(page: Page): Promise<void> {
    await page.evaluate(({ origKey, mainKey, returnKey, errorKey }) => {
        const origFetch = window.fetch;
        (window as any)[origKey] = origFetch;
        (window as any)[mainKey] = null;
        (window as any)[returnKey] = null;
        (window as any)[errorKey] = null;
        window.fetch = async function (...args: any[]) {
            const response = await origFetch.apply(this, args as any);
            try {
                const url = (args[0] instanceof Request ? args[0].url : String(args[0])) || '';
                if (url.includes('task_executor') && response.ok) {
                    const clone = response.clone();
                    const body = await clone.json();
                    if (url.includes('task=return_label')) {
                        if (body?.error) {
                            (window as any)[errorKey] = body.error;
                        } else {
                            (window as any)[returnKey] = body;
                        }
                    } else if (!(window as any)[mainKey]) {
                        (window as any)[mainKey] = body;
                    }
                }
            } catch { /* ignore */ }
            return response;
        };
    }, { origKey: RL_ORIG_FETCH_KEY, mainKey: RL_MAIN_KEY, returnKey: RL_RETURN_KEY, errorKey: RL_ERROR_KEY });
}

/** Read the current contents of the three return-label slots. */
export async function readReturnLabelCapture(page: Page): Promise<ReturnLabelInterceptorSnapshot> {
    return page.evaluate(({ mainKey, returnKey, errorKey }) => ({
        main: (window as any)[mainKey],
        returnLabel: (window as any)[returnKey],
        returnError: (window as any)[errorKey],
    }), { mainKey: RL_MAIN_KEY, returnKey: RL_RETURN_KEY, errorKey: RL_ERROR_KEY });
}

/** Clear only the return-label slots before a retry; the main label capture is kept. */
export async function resetReturnLabelSlots(page: Page): Promise<void> {
    await page.evaluate(({ returnKey, errorKey }) => {
        (window as any)[returnKey] = null;
        (window as any)[errorKey] = null;
    }, { returnKey: RL_RETURN_KEY, errorKey: RL_ERROR_KEY });
}

/** Restore the original fetch and delete all return-label slots. Safe if the page closed. */
export async function restoreReturnLabelInterceptor(page: Page): Promise<void> {
    await page.evaluate(({ origKey, mainKey, returnKey, errorKey }) => {
        if ((window as any)[origKey]) {
            window.fetch = (window as any)[origKey];
        }
        delete (window as any)[mainKey];
        delete (window as any)[returnKey];
        delete (window as any)[errorKey];
        delete (window as any)[origKey];
    }, { origKey: RL_ORIG_FETCH_KEY, mainKey: RL_MAIN_KEY, returnKey: RL_RETURN_KEY, errorKey: RL_ERROR_KEY })
        .catch(() => { /* page might be closed */ });
}
