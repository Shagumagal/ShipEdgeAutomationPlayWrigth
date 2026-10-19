/**
 * Carrier matrix — which carriers and ship methods of a warehouse actually work, probed through
 * the Configure Shipment panel of the shipper view. Pure module — no Playwright, no file system.
 *
 * One matrix entry is one thing Configure Shipment lets you pick:
 *   - a Ship Code (a saved carrier account + ship method + package type), or
 *   - a Carrier + Ship Method pair picked by hand.
 * Each entry becomes one test (v2/carrier-matrix/carrier-matrix.spec.ts) and one row of the
 * report (v2/carrier-matrix/carrier-matrix-reporter.ts). See docs/19-carrier-matrix.md.
 *
 * Covered by v2/unit/carrier-matrix.unit.spec.ts.
 */

export type CarrierMatrixEntryKind = 'shipCode' | 'carrierMethod';

export interface CarrierMatrixEntry {
    /** Stable key, also used to keep manual edits when discovery runs again. */
    id: string;
    kind: CarrierMatrixEntryKind;
    /** Ship Code option text (kind 'shipCode'). */
    shipCode?: string;
    /**
     * Which option to pick when the Ship Code dropdown repeats the same text (1-based). Codes can
     * be repeated across carrier accounts (e.g. EUSPMD in two USPS accounts of qa20).
     */
    occurrence?: number;
    /** As Configure Shipment shows them (discovered), or the options to pick (kind 'carrierMethod'). */
    carrier?: string | null;
    method?: string | null;
    packageType?: string | null;
    /** false → reported as skipped, e.g. a pair a ship code already covers. */
    enabled: boolean;
    /** Why it is disabled, or anything QA should know about it. */
    note?: string;
}

export interface CarrierMatrixFile {
    warehouse: string;
    discoveredAt: string;
    entries: CarrierMatrixEntry[];
}

/** rates: the method must get a rate (nothing is bought). label: buy the label and void it. */
export type CarrierMatrixMode = 'rates' | 'label';

export type ProbeStatus =
    | 'works'            // rates: the method got a rate · label: label bought and voided
    | 'rate-not-offered' // rates came back, but none for this method
    | 'no-rates'         // the shipment got no rates at all
    | 'label-failed'     // GET LABELS was rejected or produced no label
    | 'void-failed'      // the label was bought but could not be voided: void it by hand
    | 'config-error'     // Configure Shipment could not select the entry
    | 'skipped'
    | 'error';           // anything else (setup, automation, Xenvio)

export interface CarrierProbeRecord {
    entryId: string;
    title: string;
    mode: CarrierMatrixMode;
    status: ProbeStatus;
    message: string;
    /** What Configure Shipment showed after selecting the entry. */
    shipCode: string | null;
    carrier: string | null;
    method: string | null;
    packageType: string | null;
    /** Text of the rate card that matched the method. */
    rate: string | null;
    offeredRates: string[];
    trackingNumbers: string[];
    finalPostage: number | null;
    shipmentNumber: string | null;
    shipmentLink: string | null;
    /** Carrier reason added by the carrierDiagnostics fixture (View Requests), when it found one. */
    diagnosis?: string | null;
    durationMs: number;
}

/** Test annotation that ties a test to its entry, so the reporter finds it even after a timeout. */
export const CARRIER_MATRIX_ENTRY_ANNOTATION = 'carrier-matrix-entry';
/** Test attachment that carries the CarrierProbeRecord to the reporter. */
export const CARRIER_MATRIX_RECORD_ATTACHMENT = 'carrier-matrix-result';

// ─── Text helpers ────────────────────────────────────────────────────────

/** Lowercase letters and digits only: "FedEx Ground®" and "FEDEX_GROUND" both become "fedexground". */
export function compactText(text: string | null | undefined): string {
    return (text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const INTERNATIONAL = /international|\bintl\b|global|worldwide|world ?wide|export/i;

/** Methods meant for international shipments: the probe order is domestic, so they get no rate. */
export function isInternationalMethod(...texts: Array<string | null | undefined>): boolean {
    return texts.some((text) => !!text && INTERNATIONAL.test(text));
}

/** Account names such as "ProductionCarrier_EZ_USPS" or "UPS prod": labels there may cost money. */
export function isProductionLikeCarrier(name: string | null | undefined): boolean {
    return !!name && /production|prod(?![a-z])|\blive\b/i.test(name);
}

// ─── Entries ─────────────────────────────────────────────────────────────

export function shipCodeEntryId(shipCode: string, occurrence = 1): string {
    return occurrence > 1 ? `code:${shipCode}#${occurrence}` : `code:${shipCode}`;
}

export function carrierMethodEntryId(carrier: string, method: string): string {
    return `method:${carrier} › ${method}`;
}

/** Test title: "[EFEXG] ezFedex Test · FedEx Ground" or "ezFedex Test · FedEx Ground". */
export function entryTitle(entry: CarrierMatrixEntry): string {
    const pair = `${entry.carrier || '?'} · ${entry.method || '?'}`;
    if (entry.kind === 'carrierMethod') return pair;
    const repeated = entry.occurrence && entry.occurrence > 1 ? ` #${entry.occurrence}` : '';
    return entry.carrier || entry.method
        ? `[${entry.shipCode}${repeated}] ${pair}`
        : `[${entry.shipCode}${repeated}]`;
}

/** Ad-hoc entries from CARRIER_MATRIX_SHIP_CODES="EFEXG, EUSEM" (no discovery file needed). */
export function shipCodeEntriesFromList(list: string): CarrierMatrixEntry[] {
    const codes = list.split(',').map((code) => code.trim()).filter(Boolean);
    return [...new Set(codes)].map((shipCode) => ({
        id: shipCodeEntryId(shipCode),
        kind: 'shipCode' as const,
        shipCode,
        enabled: true,
    }));
}

/** What discovery read after selecting one Ship Code option. */
export interface ShipCodeDiscovery {
    shipCode: string;
    carrier: string | null;
    method: string | null;
    packageType: string | null;
}

/** The Ship Method options Configure Shipment offers for one Carrier option. */
export interface CarrierMethodsDiscovery {
    carrier: string;
    methods: string[];
}

/**
 * Builds the matrix file from what discovery read in Configure Shipment.
 * Disabled by default (they stay listed, so QA can enable them by hand):
 *   - international methods, because the probe order is domestic;
 *   - Carrier + Ship Method pairs a Ship Code already covers.
 */
export function buildCarrierMatrix(
    warehouse: string,
    shipCodes: ShipCodeDiscovery[],
    carrierMethods: CarrierMethodsDiscovery[],
    now: Date = new Date(),
): CarrierMatrixFile {
    const entries: CarrierMatrixEntry[] = [];
    const occurrences = new Map<string, number>();
    const coveredPairs = new Map<string, string>(); // compact carrier|method → ship code

    for (const discovered of shipCodes) {
        const occurrence = (occurrences.get(discovered.shipCode) ?? 0) + 1;
        occurrences.set(discovered.shipCode, occurrence);

        const pairKey = `${compactText(discovered.carrier)}|${compactText(discovered.method)}`;
        if (discovered.carrier && discovered.method && !coveredPairs.has(pairKey)) {
            coveredPairs.set(pairKey, discovered.shipCode);
        }

        const international = isInternationalMethod(discovered.shipCode, discovered.method);
        entries.push({
            id: shipCodeEntryId(discovered.shipCode, occurrence),
            kind: 'shipCode',
            shipCode: discovered.shipCode,
            ...(occurrence > 1 ? { occurrence } : {}),
            carrier: discovered.carrier,
            method: discovered.method,
            packageType: discovered.packageType,
            enabled: !international,
            ...(international ? { note: INTERNATIONAL_NOTE } : {}),
        });
    }

    // The note on the first occurrence too, once the code turns out to be repeated.
    for (const entry of entries) {
        if (entry.kind === 'shipCode' && (occurrences.get(entry.shipCode!) ?? 0) > 1) {
            entry.note = [entry.note, REPEATED_CODE_NOTE].filter(Boolean).join(' ');
        }
    }

    const seenPairs = new Set<string>();
    for (const { carrier, methods } of carrierMethods) {
        for (const method of methods) {
            const id = carrierMethodEntryId(carrier, method);
            if (seenPairs.has(id)) continue;
            seenPairs.add(id);

            const coveredBy = coveredPairs.get(`${compactText(carrier)}|${compactText(method)}`);
            const international = isInternationalMethod(method);
            const note = coveredBy ? `Covered by ship code ${coveredBy}.` : international ? INTERNATIONAL_NOTE : undefined;
            entries.push({
                id,
                kind: 'carrierMethod',
                carrier,
                method,
                enabled: !coveredBy && !international,
                ...(note ? { note } : {}),
            });
        }
    }

    return { warehouse, discoveredAt: now.toISOString(), entries };
}

const INTERNATIONAL_NOTE = 'International method: the probe order is domestic.';
const REPEATED_CODE_NOTE = 'Repeated ship code: API v3 orders get the first account with it.';

/**
 * Keeps what QA edited by hand in the previous file (enabled, note) for the entries discovery
 * finds again. Entries that are gone are dropped; new ones keep their defaults.
 */
export function mergeWithPreviousMatrix(next: CarrierMatrixFile, previous: CarrierMatrixFile | null): CarrierMatrixFile {
    if (!previous) return next;
    const edited = new Map(previous.entries.map((entry) => [entry.id, entry]));
    return {
        ...next,
        entries: next.entries.map((entry) => {
            const before = edited.get(entry.id);
            if (!before) return entry;
            const merged: CarrierMatrixEntry = { ...entry, enabled: before.enabled };
            if (before.note) merged.note = before.note;
            return merged;
        }),
    };
}

/** Why an entry must not run, or null when it should. */
export function entrySkipReason(
    entry: CarrierMatrixEntry,
    mode: CarrierMatrixMode,
    allowProduction: boolean,
): string | null {
    if (!entry.enabled) return entry.note || 'Disabled in the carrier matrix file.';
    return labelGuard(mode, entry.carrier, allowProduction);
}

/** In label mode, refuse production-like accounts unless CARRIER_MATRIX_ALLOW_PRODUCTION=1. */
export function labelGuard(mode: CarrierMatrixMode, carrier: string | null | undefined, allowProduction: boolean): string | null {
    if (mode !== 'label' || allowProduction || !isProductionLikeCarrier(carrier)) return null;
    return `"${carrier}" looks like a production account and label mode buys a real label `
        + '(set CARRIER_MATRIX_ALLOW_PRODUCTION=1 to include it).';
}

// ─── Rates ───────────────────────────────────────────────────────────────

/**
 * Index of the rate card that belongs to the ship method, or null when the method got no rate.
 * A card matches when it contains the method name (compared without case, spaces or symbols).
 * Among several matches ("Priority Mail" also matches "Priority Mail Express") the one that
 * also names the carrier wins, then the one with the fewest extra letters.
 */
export function pickMatchingRate(
    cards: string[],
    target: { carrier?: string | null; method?: string | null },
): number | null {
    const method = compactText(target.method);
    if (!method) return null;
    const carrier = compactText(target.carrier);

    const candidates = cards
        .map((text, index) => ({ index, text: compactText(text) }))
        .filter((card) => card.text.includes(method))
        .map((card) => ({
            index: card.index,
            namesCarrier: carrier !== '' && card.text.includes(carrier),
            // Prices and dates change between cards; letters show how much else the card says.
            extraLetters: card.text.replace(/\d/g, '').length,
        }));
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => Number(b.namesCarrier) - Number(a.namesCarrier) || a.extraLetters - b.extraLetters);
    return candidates[0].index;
}

// ─── Records ─────────────────────────────────────────────────────────────

export function newProbeRecord(entry: CarrierMatrixEntry, mode: CarrierMatrixMode): CarrierProbeRecord {
    return {
        entryId: entry.id,
        title: entryTitle(entry),
        mode,
        status: 'error',
        message: '',
        shipCode: entry.shipCode ?? null,
        carrier: entry.carrier ?? null,
        method: entry.method ?? null,
        packageType: entry.packageType ?? null,
        rate: null,
        offeredRates: [],
        trackingNumbers: [],
        finalPostage: null,
        shipmentNumber: null,
        shipmentLink: null,
        durationMs: 0,
    };
}

/** Record for a test that ended without attaching one (timeout, setup failure, skipped early). */
export function fallbackProbeRecord(
    entryId: string,
    title: string,
    mode: CarrierMatrixMode,
    status: ProbeStatus,
    message: string,
): CarrierProbeRecord {
    return {
        ...newProbeRecord({ id: entryId, kind: 'shipCode', enabled: true }, mode),
        title,
        shipCode: null,
        status,
        message,
    };
}

// ─── Summary ─────────────────────────────────────────────────────────────

export const STATUS_ICONS: Record<ProbeStatus, string> = {
    'works': '✅',
    'rate-not-offered': '⚠️',
    'no-rates': '❌',
    'label-failed': '❌',
    'void-failed': '🛑',
    'config-error': '🧩',
    'skipped': '⏭️',
    'error': '💥',
};

const STATUS_ORDER: ProbeStatus[] = [
    'void-failed', 'label-failed', 'no-rates', 'rate-not-offered', 'config-error', 'error', 'works', 'skipped',
];

export interface MatrixChange {
    title: string;
    from: ProbeStatus;
    to: ProbeStatus;
}

export interface CarrierMatrixSummary {
    records: CarrierProbeRecord[];
    counts: Partial<Record<ProbeStatus, number>>;
    /** Worked in the previous run of the same mode and does not work now. */
    regressions: MatrixChange[];
    /** Did not work in the previous run and works now. */
    fixed: MatrixChange[];
}

/** Sorts the rows (problems first, then by carrier) and compares with the previous run. */
export function summarizeMatrix(
    records: CarrierProbeRecord[],
    previous: CarrierProbeRecord[] = [],
): CarrierMatrixSummary {
    const sorted = [...records].sort((a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        || (a.carrier ?? '').localeCompare(b.carrier ?? '')
        || a.title.localeCompare(b.title));

    const counts: Partial<Record<ProbeStatus, number>> = {};
    for (const record of sorted) counts[record.status] = (counts[record.status] ?? 0) + 1;

    const before = new Map(previous.map((record) => [record.entryId, record.status]));
    const regressions: MatrixChange[] = [];
    const fixed: MatrixChange[] = [];
    for (const record of sorted) {
        const from = before.get(record.entryId);
        if (!from || from === record.status || from === 'skipped' || record.status === 'skipped') continue;
        if (from === 'works') regressions.push({ title: record.title, from, to: record.status });
        else if (record.status === 'works') fixed.push({ title: record.title, from, to: record.status });
    }

    return { records: sorted, counts, regressions, fixed };
}

export function renderMatrixMarkdown(
    summary: CarrierMatrixSummary,
    meta: { warehouse: string; mode: CarrierMatrixMode; generatedAt: Date },
): string {
    const lines: string[] = [];
    lines.push(`# Carrier matrix — ${meta.warehouse} (${meta.mode} mode) — ${meta.generatedAt.toISOString()}`);
    lines.push('');
    lines.push(STATUS_ORDER
        .filter((status) => summary.counts[status])
        .map((status) => `${STATUS_ICONS[status]} ${summary.counts[status]} ${status}`)
        .join(' · '));

    if (summary.regressions.length || summary.fixed.length) {
        lines.push('', '## Changes since the previous run', '');
        for (const change of summary.regressions) lines.push(`- 🔻 ${change.title}: ${change.from} → ${change.to}`);
        for (const change of summary.fixed) lines.push(`- 🔺 ${change.title}: ${change.from} → ${change.to}`);
    }

    lines.push('', '| Status | Ship code | Carrier | Ship method | Detail | Shipment |', '|---|---|---|---|---|---|');
    for (const record of summary.records) {
        const detail = [record.message, record.diagnosis].filter(Boolean).join(' — ');
        const shipment = record.shipmentLink
            ? `[${record.shipmentNumber ?? 'open'}](${record.shipmentLink})`
            : record.shipmentNumber ?? '';
        // A test that ended before the probe (timeout, setup) only knows its title.
        const identified = record.shipCode || record.carrier || record.method;
        lines.push(`| ${[
            `${STATUS_ICONS[record.status]} ${record.status}`,
            identified ? record.shipCode ?? '' : record.title,
            record.carrier ?? '',
            record.method ?? '',
            detail,
            shipment,
        ].map(cell).join(' | ')} |`);
    }
    return `${lines.join('\n')}\n`;
}

function cell(text: string): string {
    const clean = text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
    return clean.length > 160 ? `${clean.slice(0, 159)}…` : clean;
}
