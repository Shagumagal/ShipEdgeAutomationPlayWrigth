import { Page, TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import logger from './logger';

/**
 * Test Failure Artifact Capture Utility
 *
 * This utility captures comprehensive artifacts when tests fail, including:
 * - Screenshots
 * - Page source code
 * - Error messages and stack traces
 * - Current URL
 *
 * Artifacts are automatically attached to the Allure Report and test results
 * with a "failure_" prefix in the name of the generated files.
 *
 * To enable artifact capturing, each test spec file should include a `test.afterEach()` hook with
 * a call to the `captureTestFailure()` method.
 *
 * Example:
 * test.afterEach(async ({ page }, testInfo) => {
 *   if (testInfo.status !== testInfo.expectedStatus) {
 *     const error = new Error(`Test failed with status: ${testInfo.status}`);
 *     await captureTestFailure(page, testInfo, error);
 *   }
 * });
 */

// Function to strip ANSI color codes from a string
function stripAnsiCodes(str: string): string {
    // This regex matches ANSI escape codes
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[\d+m/g, '');
}

export async function captureTestFailure(page: Page, testInfo: TestInfo, error: Error) {
    const log = logger({ filename: __filename });
    
    log.error('Capturing test failure artifacts', {
        testTitle: testInfo.title,
        status: testInfo.status,
        url: page.url(),
        retry: testInfo.retry,
        duration: testInfo.duration,
        error: error.message
    });

    const timeTimestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/:/g, '_');

    const dateTimestamp = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '_');

    const testTitle = testInfo.title.toString().replace(/[\s–]/g, "_");

    try {
        // Capture screenshot
        const screenshotName = `failure_screenshot_${timeTimestamp}_${dateTimestamp}_${testTitle}.png`;
        const screenshot = await page.screenshot({ fullPage: true });
        await allure.attachment(screenshotName, screenshot, 'image/png');

        // Capture page source
        const sourceCodeName = `failure_src_code_${timeTimestamp}_${dateTimestamp}_${testTitle}.html`;
        const pageSource = await page.content();
        await allure.attachment(sourceCodeName, pageSource, 'text/html');

        // Save error message
        const errorName = `failure_error_msg_${timeTimestamp}_${dateTimestamp}_${testTitle}.txt`;

        // Get the detailed error from testInfo.error which contains the full Playwright error details
        const detailedError = testInfo.error || error;
        let errorLog = '';

        if (detailedError) {
            // Clean the error message by stripping ANSI color codes
            const cleanMessage = stripAnsiCodes(detailedError.message);
            const cleanStack = detailedError.stack ? stripAnsiCodes(detailedError.stack) : '';

            errorLog = `Error: ${cleanMessage}\n\nStack Trace:\n${cleanStack}`;

            // If the error has a cause (which often contains more specific details)
            if (detailedError.cause) {
                const cleanCause = stripAnsiCodes(detailedError.cause.toString());
                errorLog += `\n\nRoot cause:\n${cleanCause}`;
            }
        } else {
            errorLog = `Error message: ${stripAnsiCodes(error.message)}\n\nStack Trace:\n${stripAnsiCodes(error.stack || '')}`;
        }

        await allure.attachment(errorName, errorLog, 'text/plain');

        // Save current URL
        const currentUrlFilename = `failure_current_url_${timeTimestamp}_${dateTimestamp}_${testTitle}.txt`;
        const currentUrlContent = page.url();
        await allure.attachment(currentUrlFilename, currentUrlContent, 'text/plain');
        
        log.info('Test failure artifacts captured successfully', {
            testTitle: testInfo.title,
            artifacts: ['screenshot', 'page_source', 'error_message', 'current_url']
        });
    } catch (captureError) {
        log.error('Failed to capture error artifacts', {
            testTitle: testInfo.title,
            error: captureError instanceof Error ? captureError.message : 'Unknown error'
        });
    }
}