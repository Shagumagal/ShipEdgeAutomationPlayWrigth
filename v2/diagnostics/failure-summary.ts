/**
 * Text of the "Resumen del fallo" attachment — pure logic, no Playwright.
 *
 * It is the first thing QA reads on a red test, so it answers: what failed, where in this
 * repository, in what state, on which pages, and the full error without console colors.
 * Covered by v2/unit/failure-summary.unit.spec.ts.
 */

/** Only the fields of TestInfo this summary needs (keeps it testable without Playwright). */
export interface FailureSummaryInput {
    title: string;
    status: string;
    retry: number;
    durationMs: number;
    error?: { message?: string; stack?: string };
    otherErrors?: Array<{ message?: string }>;
    urls: string[];
}

/** Console colors make the message unreadable inside an attachment. */
export function stripAnsiCodes(text: string): string {
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
export function buildFailureSummary(input: FailureSummaryInput): string {
    const { error, urls } = input;
    const message = stripAnsiCodes(error?.message ?? 'Sin mensaje de error');
    const stack = error?.stack ? stripAnsiCodes(error.stack) : '';
    const headline = message.split('\n')[0];
    const where = firstProjectFrame(stack) ?? 'sin ubicación';

    const lines = [
        `# ${input.title}`,
        '',
        `**Qué falló:** ${headline}`,
        `**Dónde:** ${where}`,
        `**Estado:** ${input.status} · reintento ${input.retry} · duró ${formatDuration(input.durationMs)}`,
        `**Páginas abiertas:** ${urls.length ? urls.join(' · ') : 'ninguna'}`,
        '',
        '## Error completo',
        '```',
        stack || message,
        '```',
    ];

    const others = input.otherErrors ?? [];
    if (others.length > 0) {
        lines.push('', `## Otros errores (${others.length})`);
        for (const extra of others) {
            lines.push('```', stripAnsiCodes(extra.message ?? ''), '```');
        }
    }
    return lines.join('\n');
}
