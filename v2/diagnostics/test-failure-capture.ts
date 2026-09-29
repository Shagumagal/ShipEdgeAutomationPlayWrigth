import { Page, TestInfo } from '@playwright/test';
import { buildFailureSummary } from './failure-summary';
import logger from "../infrastructure/logger";

/**
 * Failure evidence — ONE place, so a failed test does not end up with ten
 * near-identical attachments.
 *
 * What a failure attaches:
 *   - "Failure summary" — what failed, where, on which page and the full error without
 *     ANSI codes, so triage does not start by digging through the stack trace.
 *   - "Screen at failure" — full-page screenshot of every open page (the Shipper View
 *     popup included, which is where most failures happen).
 *   - "Page HTML" — the DOM of the page where the test was working, for selector issues.
 *   - "Browser console" — console output plus the URL of each page.
 * Playwright and Allure add video, trace, error-context, stdout and stderr on their own.
 * Nothing is duplicated here, on purpose.
 *
 * Attachments go through `testInfo.attach`, so they show up in both the Playwright HTML
 * report and Allure with the same name. `playwright.config.ts` keeps `screenshot: 'off'`
 * because this collector owns that.
 *
 * Wired as the auto fixture `saveAttachments` (v2/lib/helpers-fixtures.ts); specs do not
 * need an afterEach hook.
 */

const MAX_HTML_CHARS = 2 * 1024 * 1024;

export interface FailureEvidenceInput {
    /** Pages to photograph; usually context.pages() (main window + Shipper View popup). */
    pages: Page[];
    /** Browser console output collected during the test. */
    consoleLines: string[];
}

/** Never throws: a problem collecting evidence must not hide the real failure. */
export async function captureFailureEvidence(
    testInfo: TestInfo,
    { pages, consoleLines }: FailureEvidenceInput,
): Promise<void> {
    const log = logger({ filename: __filename });
    const openPages = pages.filter((page) => !page.isClosed());

    log.error('Test failed — collecting evidence', {
        testTitle: testInfo.title,
        status: testInfo.status,
        retry: testInfo.retry,
        pages: openPages.length,
    });

    const urls = openPages.map((page) => page.url());

    try {
        await testInfo.attach('Failure summary', {
            body: buildFailureSummary({
                title: testInfo.title,
                status: testInfo.status ?? 'unknown',
                retry: testInfo.retry,
                durationMs: testInfo.duration,
                error: testInfo.error,
                otherErrors: testInfo.errors.slice(1),
                urls,
            }),
            contentType: 'text/markdown',
        });
    } catch {
        // The remaining evidence still goes out.
    }

    for (const [index, page] of openPages.entries()) {
        const suffix = openPages.length > 1 ? ` (${index + 1}/${openPages.length})` : '';
        try {
            await testInfo.attach(`Screen at failure${suffix}`, {
                body: await page.screenshot({ fullPage: true }),
                contentType: 'image/png',
            });
        } catch {
            // The page may be closing; the remaining evidence still goes out.
        }
    }

    const lastPage = openPages[openPages.length - 1];
    if (lastPage) {
        try {
            const html = await lastPage.content();
            await testInfo.attach('Page HTML', {
                body: html.length > MAX_HTML_CHARS ? `${html.slice(0, MAX_HTML_CHARS)}\n<!-- truncated -->` : html,
                contentType: 'text/html',
            });
        } catch {
            // Not critical.
        }
    }

    try {
        const body = [
            `Test    : ${testInfo.title}`,
            `Status  : ${testInfo.status} (retry ${testInfo.retry})`,
            ...urls.map((url, index) => `[page ${index + 1}] ${url}`),
            '',
            ...(consoleLines.length ? consoleLines : ['(no console messages)']),
        ].join('\n');
        await testInfo.attach('Browser console', { body, contentType: 'text/plain' });
    } catch {
        // Not critical.
    }
}
