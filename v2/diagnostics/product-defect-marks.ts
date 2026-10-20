/**
 * Marks shared by the contract checks (product-contract.ts, inside the test) and the reporter
 * (defect-candidate-reporter.ts, in the runner process). No Playwright import, so the reporter can
 * load it without loading the test API.
 */

/** Tag that Allure files under "Product defect candidate" (playwright.config.ts). */
export const PRODUCT_DEFECT_TAG = '[PRODUCT DEFECT CANDIDATE]';
export const PRODUCT_DEFECT_TAG_PATTERN = PRODUCT_DEFECT_TAG.replace(/[[\]]/g, '\\$&');

/** Per-attempt marks the reporter reads (TestResult.annotations / attachments). */
export const CONTRACT_CHECKED = 'contract';
export const CONTRACT_PASSED = 'contract passed';
export const CONTRACT_VIOLATED = 'contract violated';
export const VIOLATION_ATTACHMENT = 'product-defect-candidate.json';

export function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\u001b\[[0-9;]*m/g, '');
}
