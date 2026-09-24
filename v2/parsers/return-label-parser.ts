/**
 * Pure logic for the GET LABELS + automatic return label flow.
 *
 * Nothing in this file touches Playwright, the browser or the evidence layer,
 * so every rule (which response wins, when to retry, how errors and results
 * are read) is unit tested in v2/unit/return-label-parser.unit.spec.ts.
 */

import { errorToText } from '../domain/carriers/carrier-errors';
import { isTransientCarrierError } from '../domain/carriers/carrier-retry-policy';

/** Snapshot of what the browser-side interceptor has captured so far. */
export interface ReturnLabelCaptureSnapshot {
    main: any | null;
    returnLabel: any | null;
    returnError: any | null;
}

/** Raw outcome of the browser workflow, before interpretation. */
export interface ReturnLabelCapture {
    /** Response used for validation: the return_label response, or the main one as fallback. */
    responseBody: any;
    mainLabelBody: any | null;
    returnLabelBody: any | null;
    /** Last return_label error seen (null when the return label was finally captured). */
    returnLabelError: any | null;
    /** First return_label error, kept even if the retry succeeded, for evidence. */
    initialReturnLabelError: any | null;
    /** True when a retryable error happened and "GET RETURN LABEL" was clicked. */
    retried: boolean;
    /** PNG of the "Return label created successfully" toast, taken the moment it appeared; null if never seen. */
    successToastScreenshot: Buffer | null;
}

/** Fields the return label scenario validates, read from shipments[0].boxes[0]. */
export interface ReturnLabelResult {
    shipmentNumber: string | null;
    shipmentState: string | null;
    isAutoReturnLabel: unknown;
    finalPostage: number | null;
    shippingCost: number | null;
    forwardLabelUrl: string | null;
    returnLabelUrl: string | null;
    trackingNumber: string | null;
    boxState: string | null;
}

// ─── Error interpretation ────────────────────────────────────────────────────
//
// The API has returned return_label errors in more than one shape. A real
// example captured from QA (carrier rejection, NOT retryable):
//
//   {"error":"carrier response error: {\"errors\":[{\"error_code\":\"800000\",
//     \"error_message\":\"The is_return_label specified is invalid.\"}]}"}
//
// i.e. `body.error` is a STRING with escaped JSON inside. Other responses may
// use an object with `code`. Detection therefore works on a normalized text
// representation, tolerant to quotes, escapes and key naming.

/** Error codes that are worth one retry with the "GET RETURN LABEL" button. */
export const RETRYABLE_RETURN_LABEL_CODES: readonly string[] = ['1008'];

const MAX_DESCRIPTION_LENGTH = 200;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches `<key><quotes/escapes><separator><quotes/escapes><code>` where key is
 * error_code / errorCode / code / error, e.g.:
 *   {"code":1008}   "error_code":"1008"   \"error_code\":\"1008\"   Error 1008   code: 1008
 * The code must not be followed by another digit (so 10080 does not match), and
 * keys like error_reference_id never match, so UUIDs containing 1008 are safe.
 */
function codePattern(code: string): RegExp {
    return new RegExp(
        `(?:error_code|errorcode|\\bcode|\\berror)[\\\\"']*\\s*[:=#]?\\s*[\\\\"']*${escapeRegExp(code)}(?!\\d)`,
        'i',
    );
}

/** True only for errors that a retry can plausibly fix (see RETRYABLE_RETURN_LABEL_CODES). */
export function isRetryableReturnLabelError(
    error: unknown,
    retryableCodes: readonly string[] = RETRYABLE_RETURN_LABEL_CODES,
): boolean {
    if (error === null || error === undefined || error === '') return false;

    if (typeof error === 'number') {
        return retryableCodes.includes(String(error));
    }

    const text = errorToText(error).trim();
    if (retryableCodes.includes(text)) return true;

    return retryableCodes.some((code) => codePattern(code).test(text));
}

/** Retry with "GET RETURN LABEL" only when there is no return label AND the error is retryable. */
/** Retry when there is no return label and the error is 1008 or a transient carrier error. */
export function shouldRetryReturnLabel(returnLabelBody: unknown, returnLabelError: unknown): boolean {
    return !returnLabelBody
        && (isRetryableReturnLabelError(returnLabelError) || isTransientCarrierError(returnLabelError));
}

/** Extracts an error code from any shape, e.g. "800000" or "1008". */
export function extractReturnLabelErrorCode(error: unknown): string | null {
    if (typeof error === 'number') return String(error);
    const text = errorToText(error);
    const match = text.match(/(?:error_code|errorcode|\bcode)[\\"']*\s*[:=]\s*[\\"']*([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
}

/** Extracts a human message from any shape, e.g. "The is_return_label specified is invalid." */
export function extractReturnLabelErrorMessage(error: unknown): string | null {
    const text = errorToText(error);
    const match = text.match(/(?:error_message|errormessage|\bmessage)[\\"']*\s*:\s*[\\"']+([^"\\]+)/i);
    return match ? match[1].trim() : null;
}

/** One-line description for logs and evidence: "800000 (The is_return_label specified is invalid.)". */
export function describeReturnLabelError(error: unknown): string {
    if (error === null || error === undefined || error === '') return 'unknown';

    const code = extractReturnLabelErrorCode(error);
    const message = extractReturnLabelErrorMessage(error);

    if (code && message) return `${code} (${message})`;
    if (code) return code;
    if (message) return message;
    if (typeof error === 'string') return error.trim().slice(0, MAX_DESCRIPTION_LENGTH) || 'unknown';
    return 'unknown';
}

// ─── Capture and response interpretation ─────────────────────────────────────

/** The first polling phase ends as soon as the return_label call answered, with data or with an error. */
export function isReturnLabelSettled(snapshot: ReturnLabelCaptureSnapshot): boolean {
    return Boolean(snapshot.returnLabel || snapshot.returnError);
}

/** The return_label response carries both URLs; the main label response is only a fallback. */
export function selectReturnLabelResponse(returnLabelBody: any, mainLabelBody: any): any | null {
    return returnLabelBody || mainLabelBody || null;
}

/** Reads the fields the scenario asserts on. Missing data becomes null, never throws. */
export function parseReturnLabelResponse(responseBody: any): ReturnLabelResult {
    const shipment = responseBody?.shipments?.[0];
    const box = shipment?.boxes?.[0];

    return {
        shipmentNumber: shipment?.shipmentNumber ?? null,
        shipmentState: shipment?.aasmState ?? null,
        isAutoReturnLabel: shipment?.isAutoReturnLabel,
        finalPostage: shipment?.finalPostage ?? null,
        shippingCost: shipment?.shippingCost ?? null,
        forwardLabelUrl: box?.label ?? null,
        returnLabelUrl: box?.returnLabel ?? null,
        trackingNumber: box?.trackingNumber ?? null,
        boxState: box?.aasmState ?? null,
    };
}
