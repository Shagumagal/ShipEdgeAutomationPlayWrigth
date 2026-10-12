/** Configuration records the tests create in Xenvio. Pure module — no Playwright. */
export type TestDataKind = 'carrierAccount' | 'app' | 'bestRate';

const DATE_TO_MINUTE = '\\d{4}-\\d{2}-\\d{2}_\\d{2}h\\d{2}';

/**
 * True when `name` is one the tests generate, so the purge can tell automation data from data
 * people created (v2/unit/test-data.unit.spec.ts keeps these in sync with the generators):
 *  - carriers:   XenvioCarrierConfigPage.generateCarrierName → "USPS Carrier 2026-10-12_14h23"
 *                (deprecated data-driven test → "USPS Auto 2026-10-12_14h23")
 *  - apps:       XenvioCreateAppPage.generateAppName → "qa20-app-14h23"
 *  - best rates: XenvioBestRatePage.generateBestRateName → "Best Rate Auto 2026-10-12_16h45m32s_W0"
 */
export function isAutomationName(kind: TestDataKind, name: string, warehouse: string): boolean {
    return automationNamePattern(kind, warehouse).test(name);
}

function automationNamePattern(kind: TestDataKind, warehouse: string): RegExp {
    switch (kind) {
        case 'carrierAccount': return new RegExp(`^.+ (Carrier|Auto) ${DATE_TO_MINUTE}$`);
        case 'app': return new RegExp(`^${escapeRegExp(warehouse)}-app-\\d{2}h\\d{2}$`);
        case 'bestRate': return new RegExp(`^Best Rate (Auto|QA) ${DATE_TO_MINUTE}m\\d{2}s(_W\\d+)?$`);
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
