import { test as base } from "@playwright/test";
import * as fs from 'fs';
import { attachment } from "allure-js-commons";
import logger from "./logger";

/**
 * Helper Fixtures
 * 
 * This file defines custom Playwright fixtures that extend the base test functionality.
 * 
 * Auto Fixtures:
 * - Fixtures marked with { auto: true } run automatically after the test completes
 * - They don't need to be explicitly called in the test body
 * - They must be included in the test parameters to be activated
 * - Useful for cleanup, artifact collection, and post-test actions
 */
type helperFixture = {
    waitForPageLoad: () => Promise<void>;
    saveAttachments: void,      // Auto fixture: Captures console logs and screenshots on test failure
    saveBrowserVersion: void    // Auto fixture: Saves browser version information
}

export const test = base.extend<helperFixture>({
    waitForPageLoad:async ({page}, use) => {
        const log = logger({ filename: __filename });
        log.debug('Waiting for page load', { url: page.url() });
        await page.goto('/');
        await page.waitForLoadState('load', {timeout: 60000});
        await page.waitForLoadState('domcontentloaded', {timeout: 60000});
        await page.waitForLoadState('networkidle', {timeout: 60000});
        log.debug('Page load completed');
        use(() => Promise.resolve());
    },

    /**
     * Auto Fixture: saveAttachments
     * 
     * Automatically captures console logs and screenshots when a test fails.
     * Runs automatically after the test completes (due to { auto: true }).
     * 
     * What it does:
     * - Collects all console messages during test execution
     * - On test failure: Saves console logs and screenshot to test artifacts
     * - Attaches artifacts to both Allure report and Playwright test info
     * 
     * Usage: Include in test parameters - it runs automatically
     * test('My test', async ({ page, saveAttachments }) => { ... })
     */
    saveAttachments: [async ({ page }, use, testInfo) => {
        const log = logger({ filename: __filename });
        const logs: Array<string> = [];
        page.on('console', (msg) => {
            logs.push(`${msg.type()}: ${msg.text()}`);
        });

        await use();

        if (testInfo.status !== testInfo.expectedStatus) {
            log.error('Test failed - capturing artifacts', {
                testTitle: testInfo.title,
                status: testInfo.status,
                retry: testInfo.retry,
                duration: testInfo.duration
            });
            const logFile = testInfo.outputPath('logs.txt');
            await fs.promises.writeFile(logFile, logs.join('\n'), 'utf8');
            testInfo.attachments.push({ name: 'logs', contentType: 'text/plain', path: logFile });
            const screenshotBuffer = await page.screenshot();
            await attachment(`${testInfo.title}-${testInfo.status}`, screenshotBuffer, {
                contentType: 'image/png',
            });
            await testInfo.attach('screenshot', {
                body: screenshotBuffer,
                contentType: 'image/png' 
            });
        }
    }, { auto: true }],

    /**
     * Auto Fixture: saveBrowserVersion
     * 
     * Automatically saves browser version information for every test run.
     * Runs automatically after the test completes (due to { auto: true }).
     * 
     * What it does:
     * - Captures the browser version (e.g., "Chrome 120.0.6099.109")
     * - Saves it as a text file attachment
     * - Useful for debugging browser-specific issues
     * 
     * Usage: Include in test parameters - it runs automatically
     * test('My test', async ({ page, saveBrowserVersion }) => { ... })
     */
    saveBrowserVersion: [async ({ browser, browserName }, use, testInfo) => {
        const log = logger({ filename: __filename });
        await use();

        const browserVersion = browser.version();
        log.debug('Browser version captured', { browser: browserName, version: browserVersion });
        const versionFile = testInfo.outputPath(`${browserName}-version.txt`);
        await fs.promises.writeFile(versionFile, [browserVersion, ''].join('\n'), 'utf8');
        testInfo.attachments.push({ name: 'browser version', contentType: 'text/plain', path: versionFile });
    }, { auto: true }],
});

// Test lifecycle hooks with logging
const log = logger({ filename: __filename });

test.beforeEach(async ({ }, testInfo) => {
    log.info('Test started', {
        testId: testInfo.title,
        project: testInfo.project.name,
        retry: testInfo.retry,
        workerIndex: testInfo.workerIndex
    });
});

test.afterEach(async ({ }, testInfo) => {
    const logData = {
        testId: testInfo.title,
        status: testInfo.status,
        duration: testInfo.duration,
        retry: testInfo.retry
    };

    if (testInfo.status === 'passed') {
        log.info('Test passed', logData);
    } else if (testInfo.status === 'failed') {
        log.error('Test failed', {
            ...logData,
            error: testInfo.error?.message || 'Unknown error'
        });
    } else if (testInfo.status === 'skipped') {
        log.warn('Test skipped', logData);
    } else {
        log.info('Test completed', logData);
    }
});

export const expect = test.expect;