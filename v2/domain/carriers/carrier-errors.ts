/**
 * What the suite knows about carrier errors — pure logic (no Playwright, no reporting).
 *
 * Xenvio logs every HTTP call it makes to ANY carrier (EasyPost, FedEx, UPS, PowerShip,
 * Ehub, ...) through `shipment.save_log2` into the `outgoings` table, exposed as JSON by
 * `GET /shipments/:id/view_requests2` (UI: History → View Requests). Reading that log is
 * carrier-agnostic: the same code works for every carrier without per-carrier integrations.
 *
 * Used by the retry policy (workflows) and by the failure report (diagnostics).
 * Covered by v2/unit/carrier-errors.unit.spec.ts.
 */

/** One row of `view_requests2` (Outbound attributes); only the fields we use. */
export interface OutgoingRecord {
    id?: number;
    request_url?: string | null;
    request_method?: string | null;
    request_header?: unknown;
    request_body?: unknown;
    response_code?: string | number | null;
    response_header?: unknown;
    response_body?: unknown;
    created_at?: string | null;
}

/** A failed carrier call from the outgoing log, reduced to what a person needs to read. */
export interface CarrierRequestError {
    carrier: string;
    method: string;
    url: string;
    status: number | null;
    code: string | null;
    message: string;
    createdAt: string | null;
    /** Basic auth header was present but user and password were empty (e.g. "Basic Og=="). */
    emptyCredentials: boolean;
}

/** A Xenvio `task_executor` call answered with an HTTP error, e.g. 400 `{ error }`. */
export interface XenvioTaskError {
    /** `task` query param: 'label', 'void_label', 'return_label', ... */
    task: string | null;
    status: number;
    /** The `error` field of the response body (usually a string), or the whole body. */
    error: unknown;
}

// ─── Text helpers ────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 300;

/** Flattens any error shape (string, number, object) into searchable text. */
export function errorToText(error: unknown): string {
    if (error === null || error === undefined) return '';
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    try {
        return JSON.stringify(error) ?? '';
    } catch {
        return String(error);
    }
}

/**
 * Parses JSON strings, including Ruby `Hash#inspect` output that some carriers are logged
 * with (e.g. UPS: `{"response"=>{"errors"=>[...]}}`). Returns the input when it is not parseable.
 */
function tryParseJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
    for (const candidate of [trimmed, trimmed.replace(/"\s*=>\s*/g, '": ').replace(/\bnil\b/g, 'null')]) {
        try {
            return JSON.parse(candidate);
        } catch {
            // try the next form
        }
    }
    return value;
}

function truncate(text: string, max = MAX_MESSAGE_LENGTH): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// ─── Carrier identification ──────────────────────────────────────────────

const KNOWN_CARRIER_HOSTS: Array<[RegExp, string]> = [
    [/(^|\.)easypost\.com$/i, 'EasyPost'],
    [/(^|\.)fedex\.com$/i, 'FedEx'],
    [/(^|\.)ups\.com$/i, 'UPS'],
    [/(^|\.)usps\.com$/i, 'USPS'],
    [/(^|\.)dhl\.com$/i, 'DHL'],
    [/(^|\.)stamps\.com$/i, 'Stamps.com'],
    [/(^|\.)shipengine\.com$/i, 'ShipEngine'],
    [/(^|\.)ehub\.com$/i, 'Ehub'],
];

/** Carrier name from the request URL; unknown carriers fall back to their hostname. */
export function carrierNameFromUrl(url: string | null | undefined): string {
    if (!url) return 'Unknown carrier';
    try {
        const host = new URL(url).hostname;
        const known = KNOWN_CARRIER_HOSTS.find(([pattern]) => pattern.test(host));
        return known ? known[1] : host;
    } catch {
        return url.slice(0, 60);
    }
}

// ─── Message extraction (carrier-agnostic) ───────────────────────────────

const MESSAGE_KEYS = ['message', 'error_message', 'errorMessage', 'description', 'detail', 'faultstring', 'title'];
const CODE_KEYS = ['code', 'error_code', 'errorCode', 'status_code'];

/** Depth-first search for the first non-empty string (or number, for codes) under the given keys. */
function findValue(node: unknown, keys: string[], acceptNumbers: boolean, depth = 0): string | null {
    if (depth > 6 || node === null || typeof node !== 'object') return null;

    if (!Array.isArray(node)) {
        const record = node as Record<string, unknown>;
        for (const key of keys) {
            const value = record[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (acceptNumbers && typeof value === 'number') return String(value);
        }
    }
    for (const child of Object.values(node as Record<string, unknown>)) {
        const found = findValue(child, keys, acceptNumbers, depth + 1);
        if (found) return found;
    }
    return null;
}

function messageFromXml(xml: string): string | null {
    const match = xml.match(/<(?:\w+:)?(?:Message|Description|faultstring|ErrorDescription)>([^<]+)</i);
    return match ? match[1].trim() : null;
}

/** Best-effort `{ code, message }` from any carrier response body (JSON, Ruby hash, XML or text). */
export function extractCarrierMessage(body: unknown): { code: string | null; message: string } {
    const parsed = tryParseJson(body);

    if (parsed && typeof parsed === 'object') {
        // A plain `{ "error": "text" }` (Xenvio style) — the string itself is the message.
        const record = parsed as Record<string, unknown>;
        const message = findValue(parsed, MESSAGE_KEYS, false)
            ?? (typeof record.error === 'string' ? record.error : null)
            ?? findValue(parsed, ['error', 'errors'], false);
        const code = findValue(parsed, CODE_KEYS, true);
        return { code, message: truncate(message ?? JSON.stringify(parsed)) };
    }

    if (typeof parsed === 'string' && parsed.trim()) {
        return { code: null, message: truncate(messageFromXml(parsed) ?? parsed) };
    }
    return { code: null, message: 'No response body' };
}

/** True when a Basic auth header carries no credentials (base64 of ":" is "Og=="). */
export function hasEmptyBasicCredentials(headers: unknown): boolean {
    const text = typeof headers === 'string' ? headers : JSON.stringify(headers ?? '');
    const match = text.match(/Basic\s+([A-Za-z0-9+/=]*)/i);
    if (!match) return false;
    try {
        return Buffer.from(match[1], 'base64').toString('utf8').replace(':', '').trim() === '';
    } catch {
        return false;
    }
}

// ─── Outgoing log ────────────────────────────────────────────────────────

function statusOf(code: OutgoingRecord['response_code']): number | null {
    const status = Number(code);
    return Number.isFinite(status) && status > 0 ? status : null;
}

/** A carrier call failed when its status is missing or outside 2xx. */
export function isFailedOutgoing(record: OutgoingRecord): boolean {
    const status = statusOf(record.response_code);
    return !(status !== null && status >= 200 && status < 300);
}

/** Rows created at or after `sinceIso` (rows without a date are kept). */
export function isOutgoingSince(record: OutgoingRecord, sinceIso?: string): boolean {
    if (!sinceIso || !record.created_at) return true;
    return Date.parse(record.created_at) >= Date.parse(sinceIso);
}

/**
 * Failed carrier calls, newest first.
 * `sinceIso` drops rows created before the test started (the caller adds clock-skew tolerance).
 */
export function summarizeCarrierErrors(records: OutgoingRecord[], sinceIso?: string): CarrierRequestError[] {
    return records
        .filter((record) => record.request_url && isOutgoingSince(record, sinceIso) && isFailedOutgoing(record))
        .map((record) => {
            const { code, message } = extractCarrierMessage(record.response_body);
            return {
                carrier: carrierNameFromUrl(record.request_url),
                method: (record.request_method ?? 'GET').toUpperCase(),
                url: record.request_url ?? '',
                status: statusOf(record.response_code),
                code,
                message,
                createdAt: record.created_at ?? null,
                emptyCredentials: hasEmptyBasicCredentials(record.request_header),
            };
        })
        .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''));
}

// ─── Xenvio task errors ──────────────────────────────────────────────────

const CARRIER_ORIGIN = /carrier (response )?(error|message)|https?:\/\/[^"\s]*(easypost|fedex|ups|usps|dhl|stamps|shipengine)|\b(easypost|fedex|ups|usps|dhl|powership|ehub|stamps\.com|shipengine)\b/i;

/** Did Xenvio report that the carrier (not Xenvio itself) rejected the operation? */
export function isCarrierTaskError(error: unknown): boolean {
    return CARRIER_ORIGIN.test(errorToText(error));
}

/** Short human text of a Xenvio task error, unwrapping embedded JSON when present. */
export function describeTaskError(error: unknown): string {
    const text = errorToText(error);
    const embedded = tryParseJson(text);
    if (embedded && typeof embedded === 'object') {
        const record = embedded as Record<string, unknown>;
        const response = typeof record.response === 'string' ? record.response : null;
        return truncate(response ?? extractCarrierMessage(embedded).message);
    }
    return truncate(text);
}
