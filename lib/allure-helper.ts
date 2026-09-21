import { Locator, Page } from "@playwright/test";
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
    async applyTestMetadata(options: TestMetadataOptions) {
        if (options.displayName) {
            await allure.displayName(options.displayName);
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
