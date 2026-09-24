import { errorToText, isCarrierTaskError } from './carrier-errors';

/**
 * Retry policy for carrier errors (pure logic, covered by unit tests).
 *
 * A Xenvio task (label, void_label, return_label) is retried ONLY when:
 *   - a failed response was actually received (a timeout without response is never
 *     retried: the label may have been purchased and a retry would duplicate it),
 *   - the error comes from the carrier (not from Xenvio itself, e.g. shipment locks), and
 *   - it looks transient (carrier API down, timeout, 5xx, "try again", rate limit) and
 *     nothing in it points to a permanent problem (credentials, missing rate, bad address).
 * Unknown errors are NOT retried: a retry must never hide a real configuration problem.
 *
 * Covered by v2/unit/carrier-retry-policy.unit.spec.ts.
 */

/** Retries after the first attempt. One is enough to absorb a sandbox blip without hiding outages. */
export const MAX_TRANSIENT_CARRIER_RETRIES = 1;
/** Pause before retrying so the carrier API has a moment to recover. */
export const TRANSIENT_RETRY_DELAY_MS = 5000;

const PERMANENT_CARRIER_ERROR = new RegExp([
    'unauthori[sz]ed', 'authori[sz]ation failed', 'forbidden', '\\b40[13]\\b',
    'invalid[ _-]?(authentication|credentials?|client|api[ _-]?key|grant|account)', 'access token', 'credential',
    'requested rate', 'has no rate', '\\bno rates?\\b',
    'invalid address', 'address (is )?invalid', 'not found', 'validation',
].join('|'), 'i');

const TRANSIENT_CARRIER_ERROR = new RegExp([
    'did not return a valid response', 'timed? ?out', 'timeout',
    'temporarily unavailable', 'service unavailable', 'try again',
    'bad gateway', 'gateway time', 'internal server error', '\\b50[0234]\\b',
    'connection (reset|refused|closed)', 'econnreset', 'econnrefused', 'socket hang up',
    'rate limit', 'too many requests', '\\b429\\b',
].join('|'), 'i');

export function isTransientCarrierError(error: unknown): boolean {
    const text = errorToText(error);
    return isCarrierTaskError(text) && TRANSIENT_CARRIER_ERROR.test(text) && !PERMANENT_CARRIER_ERROR.test(text);
}

export interface CarrierRetryDecision {
    retry: boolean;
    reason: string;
}

/** Should a task that failed with `error` be retried, given the retries already done? */
export function decideCarrierRetry(
    error: unknown,
    retriesDone: number,
    maxRetries: number = MAX_TRANSIENT_CARRIER_RETRIES,
): CarrierRetryDecision {
    if (!isTransientCarrierError(error)) {
        return { retry: false, reason: 'not a transient carrier error: not retried' };
    }
    if (retriesDone >= maxRetries) {
        return { retry: false, reason: `transient carrier error, but ${retriesDone} retry(ies) already done` };
    }
    return { retry: true, reason: `transient carrier error: retry ${retriesDone + 1} of ${maxRetries}` };
}
