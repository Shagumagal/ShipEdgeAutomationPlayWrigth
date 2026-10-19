/** Configuration records the tests create in Xenvio. Pure module — no Playwright. */
export type TestDataKind = 'carrierAccount' | 'app' | 'bestRate';

const DATE_TO_MINUTE = '\\d{4}-\\d{2}-\\d{2}_\\d{2}h\\d{2}';
const STAMP = '\\d{8}-\\d{6}-[a-z0-9]{4}';

/**
 * Unique suffix for the names the tests give to what they create: local date and time to the
 * second plus 4 random characters, so parallel workers never repeat a name (e.g. 20261019-072315-k3f9).
 */
export function automationStamp(now: Date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
        + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${random}`;
}

/**
 * True when `name` is one the tests generate, so the purge can tell automation data from data
 * people created (v2/unit/test-data.unit.spec.ts keeps these in sync with the generators):
 *  - carriers:   XenvioCarrierConfigPage.generateCarrierName → "USPS Carrier 20261019-072315-k3f9"
 *                (older runs: "USPS Carrier 2026-10-12_14h23"; deprecated data-driven: "USPS Auto 2026-10-12_14h23")
 *  - apps:       XenvioCreateAppPage.generateAppName → "qa20-app-20261019-072315-k3f9" (older runs: "qa20-app-14h23")
 *  - best rates: XenvioBestRatePage.generateBestRateName → "Best Rate Auto 2026-10-12_16h45m32s_W0"
 */
export function isAutomationName(kind: TestDataKind, name: string, warehouse: string): boolean {
    return automationNamePattern(kind, warehouse).test(name);
}

/**
 * Old enough for the purge to delete it: a test that is still running may own anything newer.
 * Names carry the local time of the machine that ran the test, so a margin of a day also covers
 * a CI machine in another time zone. Names without a date (apps from older runs, "qa20-app-14h23")
 * can only come from code that predates this check, so they count as old.
 */
export function isOldEnoughToPurge(name: string, now: Date, minAgeHours: number): boolean {
    const createdAt = automationNameDate(name);
    return !createdAt || now.getTime() - createdAt.getTime() >= minAgeHours * 60 * 60 * 1000;
}

/** When the test that named the record ran (local time), or null when the name has no date. */
export function automationNameDate(name: string): Date | null {
    const parts = name.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-[a-z0-9]{4}$/)
        ?? name.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})(?:m(\d{2})s)?/);
    if (!parts) return null;

    const [, year, month, day, hours, minutes, seconds] = parts;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds ?? 0));
}

function automationNamePattern(kind: TestDataKind, warehouse: string): RegExp {
    switch (kind) {
        case 'carrierAccount': return new RegExp(`^.+ (Carrier|Auto) (${DATE_TO_MINUTE}|${STAMP})$`);
        case 'app': return new RegExp(`^${escapeRegExp(warehouse)}-app-(\\d{2}h\\d{2}|${STAMP})$`);
        case 'bestRate': return new RegExp(`^Best Rate (Auto|QA) ${DATE_TO_MINUTE}m\\d{2}s(_W\\d+)?$`);
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
