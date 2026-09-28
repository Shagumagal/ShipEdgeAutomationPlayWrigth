import { Page, TestInfo } from '@playwright/test';
import logger from "../infrastructure/logger";

/**
 * Failure evidence — ONE place, so a failed test does not end up with ten
 * near-identical attachments.
 *
 * What a failure attaches:
 *   - "Resumen del fallo" — what failed, where, on which page and the full error without
 *     ANSI codes, so triage does not start by digging through the stack trace.
 *   - "Pantalla al fallar" — full-page screenshot of every open page (the Shipper View
 *     popup included, which is where most failures happen).
 *   - "HTML de la página" — the DOM of the page where the test was working, for selector issues.
 *   - "Consola del navegador" — console output plus the URL of each page.
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

/** Console colors make the message unreadable inside an attachment. */
function stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*m/g, '');
}

function formatDuration(ms: number): string {
    return ms >= 60000 ? `${(ms / 60000).toFixed(1)} min` : `${Math.round(ms / 1000)} s`;
}

/** First stack frame inside the repository, as a short "v2/…:line" reference. */
function firstProjectFrame(stack: string): string | null {
    for (const line of stack.split('\n')) {
        const match = line.match(/(v2\/[\w./-]+:\d+):\d+/);
        if (match) return match[1];
    }
    return null;
}

/** Human-readable summary of why the test failed, meant to be read first. */
function buildFailureSummary(testInfo: TestInfo, urls: string[]): string {
    const error = testInfo.error;
    const message = stripAnsiCodes(error?.message ?? 'Sin mensaje de error');
    const stack = error?.stack ? stripAnsiCodes(error.stack) : '';
    const headline = message.split('\n')[0];
    const where = firstProjectFrame(stack) ?? 'sin ubicación';

    const lines = [
        `# ${testInfo.title}`,
        '',
        `**Qué falló:** ${headline}`,
        `**Dónde:** ${where}`,
        `**Estado:** ${testInfo.status} · reintento ${testInfo.retry} · duró ${formatDuration(testInfo.duration)}`,
        `**Páginas abiertas:** ${urls.length ? urls.join(' · ') : 'ninguna'}`,
        '',
        '## Error completo',
        '```',
        stack || message,
        '```',
    ];

    if (testInfo.errors.length > 1) {
        lines.push('', `## Otros errores (${testInfo.errors.length - 1})`);
        for (const extra of testInfo.errors.slice(1)) {
            lines.push('```', stripAnsiCodes(extra.message ?? ''), '```');
        }
    }
    return lines.join('\n');
}

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
        await testInfo.attach('Resumen del fallo', {
            body: buildFailureSummary(testInfo, urls),
            contentType: 'text/markdown',
        });
    } catch {
        // The remaining evidence still goes out.
    }

    for (const [index, page] of openPages.entries()) {
        const suffix = openPages.length > 1 ? ` (${index + 1}/${openPages.length})` : '';
        try {
            await testInfo.attach(`Pantalla al fallar${suffix}`, {
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
            await testInfo.attach('HTML de la página', {
                body: html.length > MAX_HTML_CHARS ? `${html.slice(0, MAX_HTML_CHARS)}\n<!-- truncated -->` : html,
                contentType: 'text/html',
            });
        } catch {
            // Not critical.
        }
    }

    try {
        const body = [
            `Test   : ${testInfo.title}`,
            `Estado : ${testInfo.status} (reintento ${testInfo.retry})`,
            ...urls.map((url, index) => `[page ${index + 1}] ${url}`),
            '',
            ...(consoleLines.length ? consoleLines : ['(sin mensajes de consola)']),
        ].join('\n');
        await testInfo.attach('Consola del navegador', { body, contentType: 'text/plain' });
    } catch {
        // Not critical.
    }
}
