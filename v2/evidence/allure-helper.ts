import { Locator, Page, test } from "@playwright/test";
import * as allure from "allure-js-commons";
import { ContentType } from "allure-js-commons";

export type TestMetadataOptions = {
    displayName?: string;
    owner?: string;
    tags?: string[];
    severity?: string;
    epic?: string;
    feature?: string;
    story?: string;
    parentSuite?: string;
    suite?: string;
    subSuite?: string;
    url?: string;
    environment?: string;
};

class AllureHelper {

    async attachScreenShot(
        page: Page,
        name = 'Screenshot',
        options: { fullPage?: boolean; failOnError?: boolean } = {},
    ): Promise<void> {
        try {
            const buf: Buffer = await page.screenshot({ fullPage: options.fullPage ?? true });
            await allure.attachment(name, buf, ContentType.PNG);
        } catch (error) {
            console.error(`Failed to attach screenshot "${name}":`, error);
            if (options.failOnError) {
                throw error;
            }
        }
    }

    /** Attach a focused screenshot of a verified UI element. */
    async attachLocatorScreenshot(
        locator: Locator,
        name: string,
        options: { failOnError?: boolean } = {},
    ): Promise<void> {
        try {
            await locator.scrollIntoViewIfNeeded();
            const buf: Buffer = await locator.screenshot();
            await allure.attachment(name, buf, ContentType.PNG);
        } catch (error) {
            console.error(`Failed to attach locator screenshot "${name}":`, error);
            if (options.failOnError) {
                throw error;
            }
        }
    }

    /**
     * Business data of THIS run, shown in the report next to the test
     * (shipment, warehouse, carrier, rate, cost...). Empty values are skipped,
     * and each key is reported once — a second call with the same key updates it.
     */
    async addRunParameters(params: Record<string, string | number | null | undefined>): Promise<void> {
        for (const [name, value] of Object.entries(params)) {
            const text = `${value}`.replace(/\s+/g, ' ').trim();
            if (!text) continue;
            try {
                await allure.parameter(name, text.length > 120 ? `${text.slice(0, 119)}…` : text);
            } catch {
                // Reporting must never break a test.
            }
        }
    }

    /**
     * Attach a JSON object as evidence in Allure report.
     * Useful for capturing API responses, label URLs, and other structured data.
     */
    async attachJSON(_page: Page, name: string, data: object) {
        try {
            const json = JSON.stringify(data, null, 2);
            await allure.attachment(name, Buffer.from(json, 'utf-8'), ContentType.JSON);
        } catch (error) {
            console.error(`Failed to attach JSON "${name}":`, error);
        }
    }

    /**
     * Apply structured test metadata so Allure reports can mirror the behavior-based hierarchy.
     * Reference: https://allurereport.org/docs/playwright/
     */
    /**
     * Test case id taken from the Playwright title (e.g. "TC-Xenvio-O2L-001: ...").
     * Returns null outside a running test or when the title has no id.
     */
    private currentCaseId(): string | null {
        try {
            return test.info().title.match(/^(TC-[A-Za-z0-9._-]+)/)?.[1] ?? null;
        } catch {
            return null;
        }
    }

    async applyTestMetadata(options: TestMetadataOptions) {
        if (options.displayName) {
            // Keep the test case id visible in the report: "TC-Xenvio-O2L-001 — Order to label…"
            const caseId = this.currentCaseId();
            const name = caseId && !options.displayName.startsWith(caseId)
                ? `${caseId} — ${options.displayName}`
                : options.displayName;
            await allure.displayName(name);
            if (caseId) await allure.label('AS_ID', caseId);
        }

        if (options.owner) {
            await allure.owner(options.owner);
        }

        if (options.tags?.length) {
            await allure.tags(...options.tags);
        }

        if (options.severity) {
            await allure.severity(options.severity);
        }

        if (options.epic) {
            await allure.epic(options.epic);
        }

        if (options.feature) {
            await allure.feature(options.feature);
        }

        if (options.story) {
            await allure.story(options.story);
        }

        if (options.parentSuite) {
            await allure.parentSuite(options.parentSuite);
        }

        if (options.suite) {
            await allure.suite(options.suite);
        }

        if (options.subSuite) {
            await allure.subSuite(options.subSuite);
        }

        if (options.url) {
            await allure.parameter("URL", options.url);
        }

        if (options.environment) {
            await allure.parameter("Environment", options.environment);
        }
    }
}

export default new AllureHelper();
