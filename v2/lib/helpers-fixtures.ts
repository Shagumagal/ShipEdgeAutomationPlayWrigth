import { test as base, type Page } from "@playwright/test";
import { captureFailureEvidence } from "../diagnostics/test-failure-capture";
import logger from "../infrastructure/logger";

/**
 * Helper Fixtures (v2)
 * 
 * Auto fixtures shared by every v2 spec:
 *   - saveAttachments    → the single failure-evidence collector
 *   - saveBrowserVersion → browser version attached to the report
 */
type helperFixture = {
    waitForPageLoad: () => Promise<void>;
    saveAttachments: void,
    saveBrowserVersion: void
}

export const test = base.extend<helperFixture>({
    waitForPageLoad: async ({ page }, use) => {
        const log = logger({ filename: __filename });
        log.debug('Waiting for page load', { url: page.url() });
        await page.goto('/');
        await page.waitForLoadState('load', { timeout: 60000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        log.debug('Page load completed');
        use(() => Promise.resolve());
    },

    // Única recolección de evidencia de fallo (ver v2/diagnostics/test-failure-capture.ts).
    // Escucha la consola de todas las páginas del contexto, incluido el popup de Shipper View,
    // y adjunta solo cuando el test falla.
    saveAttachments: [async ({ context }, use, testInfo) => {
        const consoleLines: string[] = [];
        const listen = (page: Page) => page.on('console', (msg) => {
            consoleLines.push(`${msg.type()}: ${msg.text()}`);
        });
        context.pages().forEach(listen);
        context.on('page', listen);

        await use();

        if (testInfo.status !== testInfo.expectedStatus) {
            await captureFailureEvidence(testInfo, { pages: context.pages(), consoleLines });
        }
    }, { auto: true }],

    saveBrowserVersion: [async ({ browser, browserName }, use, testInfo) => {
        await use();
        await testInfo.attach('browser version', {
            body: `${browserName} ${browser.version()}\n`,
            contentType: 'text/plain',
        });
    }, { auto: true }],
});

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
