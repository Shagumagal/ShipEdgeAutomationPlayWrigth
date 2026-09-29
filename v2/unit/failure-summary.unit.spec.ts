import { test, expect } from '@playwright/test';
import { buildFailureSummary, stripAnsiCodes } from '../diagnostics/failure-summary';

const ERROR_WITH_COLORS = '\u001B[31mError: el botón GET LABELS debería estar visible\u001B[39m';

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

test.describe('Resumen del fallo', { tag: ['@unit', '@reporting'] }, () => {

    test('empieza por qué falló, sin códigos de color', () => {
        const text = summary();
        expect(text).toContain('**Qué falló:** Error: el botón GET LABELS debería estar visible');
        expect(text).not.toContain('\u001B[31m');
        expect(stripAnsiCodes('\u001B[2mhola\u001B[22m')).toBe('hola');
    });

    test('ubica el fallo en un archivo del repo, no en el stack interno de Playwright', () => {
        expect(summary()).toContain('**Dónde:** v2/page-objects/xenvio-order-to-label-page.ts:212');
    });

    test('sin stack del repo, lo dice en vez de inventar una ubicación', () => {
        const text = summary({ error: { message: 'boom', stack: '    at node_modules/playwright/lib/x.js:1:1' } });
        expect(text).toContain('**Dónde:** sin ubicación');
    });

    test('muestra estado, reintento, duración legible y las páginas abiertas', () => {
        expect(summary()).toContain('**Estado:** failed · reintento 0 · duró 1.4 min');
        expect(summary({ durationMs: 23000 })).toContain('duró 23 s');
        expect(summary()).toContain('shipper-view');
        expect(summary({ urls: [] })).toContain('**Páginas abiertas:** ninguna');
    });

    test('incluye el error completo y los errores adicionales cuando hay más de uno', () => {
        const text = summary({ otherErrors: [{ message: 'fallo en el teardown' }] });
        expect(text).toContain('## Error completo');
        expect(text).toContain('## Otros errores (1)');
        expect(text).toContain('fallo en el teardown');
        expect(summary()).not.toContain('## Otros errores');
    });

    test('soporta un fallo sin mensaje de error', () => {
        expect(summary({ error: undefined, otherErrors: [] })).toContain('Sin mensaje de error');
    });
});
