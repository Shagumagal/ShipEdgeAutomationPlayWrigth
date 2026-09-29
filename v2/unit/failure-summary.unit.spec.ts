import { test, expect } from '@playwright/test';
import { buildFailureSummary, stripAnsiCodes } from '../diagnostics/failure-summary';

const ERROR_WITH_COLORS = '\u001B[31mError: the GET LABELS button should be visible\u001B[39m';

function summary(overrides: Partial<Parameters<typeof buildFailureSummary>[0]> = {}): string {
    return buildFailureSummary({
        title: 'TC-Xenvio-O2L-001: Create domestic order and get label',
        status: 'failed',
        retry: 0,
        durationMs: 84000,
        error: {
            message: ERROR_WITH_COLORS,
            stack: `${ERROR_WITH_COLORS}\n    at XenvioOrderToLabelPage.clickGetLabels (/Users/qa/repo/v2/page-objects/xenvio-order-to-label-page.ts:212:19)`,
        },
        urls: ['https://x5demo1.shipedge.com/', 'https://x5demo1angular.shipedge.com/shipper-view'],
        ...overrides,
    });
}

test.describe('Failure summary', { tag: ['@unit', '@reporting'] }, () => {

    test('starts with what failed, without color codes', () => {
        const text = summary();
        expect(text).toContain('**What failed:** Error: the GET LABELS button should be visible');
        expect(text).not.toContain('\u001B[31m');
        expect(stripAnsiCodes('\u001B[2mhello\u001B[22m')).toBe('hello');
    });

    test('points to a file in this repo, not to Playwright internals', () => {
        expect(summary()).toContain('**Where:** v2/page-objects/xenvio-order-to-label-page.ts:212');
    });

    test('says "no location" instead of inventing one', () => {
        const text = summary({ error: { message: 'boom', stack: '    at node_modules/playwright/lib/x.js:1:1' } });
        expect(text).toContain('**Where:** no location');
    });

    test('shows state, retry, readable duration and open pages', () => {
        expect(summary()).toContain('**State:** failed · retry 0 · took 1.4 min');
        expect(summary({ durationMs: 23000 })).toContain('took 23 s');
        expect(summary()).toContain('shipper-view');
        expect(summary({ urls: [] })).toContain('**Open pages:** none');
    });

    test('includes the full error and any additional errors', () => {
        const text = summary({ otherErrors: [{ message: 'teardown failure' }] });
        expect(text).toContain('## Full error');
        expect(text).toContain('## Other errors (1)');
        expect(text).toContain('teardown failure');
        expect(summary()).not.toContain('## Other errors');
    });

    test('handles a failure without an error message', () => {
        expect(summary({ error: undefined, otherErrors: [] })).toContain('No error message');
    });
});
