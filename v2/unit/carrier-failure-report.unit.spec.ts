import { test, expect } from '@playwright/test';
import config from '../../playwright.config';
import { summarizeCarrierErrors } from '../domain/carriers/carrier-errors';
import {
    CARRIER_FAILURE_TAG,
    buildCarrierFailureReason,
    redactSensitive,
} from '../diagnostics/carrier-failure-report';
import { VOID_USPS_TRANSIENT_ERROR, easyPost401, rateShoppingNoise } from './fixtures/carrier-samples';

test.describe('Reporte de fallos de carrier', { tag: ['@unit', '@carriers'] }, () => {

    test('clasifica como externo cuando el carrier rechazó la tarea', () => {
        const reason = buildCarrierFailureReason({
            taskErrors: [{ task: 'void_label', status: 400, error: VOID_USPS_TRANSIENT_ERROR }],
            carrierErrors: [],
            noRatesVisible: false,
        });
        expect(reason).toBe(`${CARRIER_FAILURE_TAG} La tarea "void_label" fue rechazada por el carrier: the USPS API did not return a valid response`);
    });

    test('clasifica "sin rates" solo si además hubo errores de carrier', () => {
        const carrierErrors = summarizeCarrierErrors([easyPost401, rateShoppingNoise]);
        const reason = buildCarrierFailureReason({ taskErrors: [], carrierErrors, noRatesVisible: true });
        expect(reason).toContain(`${CARRIER_FAILURE_TAG} Sin rates disponibles`);
        expect(reason).toContain('EasyPost 401 UNAUTHORIZED');
        expect(reason).toContain('dragon.iot-easy.cn 500');

        expect(buildCarrierFailureReason({ taskErrors: [], carrierErrors: [], noRatesVisible: true })).toBeNull();
    });

    test('NO clasifica como externo el ruido del rate shopping ni los errores propios de Xenvio', () => {
        // Un selector que falla después de pedir rates: hay errores en el log, pero el carrier no rechazó nada.
        expect(buildCarrierFailureReason({
            taskErrors: [],
            carrierErrors: summarizeCarrierErrors([rateShoppingNoise]),
            noRatesVisible: false,
        })).toBeNull();
        expect(buildCarrierFailureReason({
            taskErrors: [{ task: 'label', status: 400, error: 'only actual owner can manage this shipment' }],
            carrierErrors: [],
            noRatesVisible: false,
        })).toBeNull();
    });

    test('enmascara credenciales que viajan en la URL (query string) y en los errores de tarea', () => {
        const redacted = JSON.stringify(redactSensitive({
            url: 'https://api.carrier.com/v1/labels?account=123&api_key=SECRET-KEY&signature=abc123',
            taskError: 'carrier response error: llamada a https://ws.carrier.com/rate?token=LEAKED-TOKEN falló',
        }));

        expect(redacted).not.toContain('SECRET-KEY');
        expect(redacted).not.toContain('abc123');
        expect(redacted).not.toContain('LEAKED-TOKEN');
        expect(redacted).toContain('api_key=[REDACTED]');
        expect(redacted).toContain('account=123');
    });

    test('enmascara credenciales en headers, hashes de Ruby, JSON y XML', () => {
        const redacted = JSON.stringify(redactSensitive({
            request_header: '{"Authorization"=>"Basic Og==", "Content-Type"=>"application/json"}',
            headers: { Authorization: 'Bearer real-token', 'x-api-key': 'k-123' },
            body: { client_id: 'abc', client_secret: 'shh', account_number: '123456', weight: 80 },
            xml: '<v1:Key>ABC</v1:Key><v1:Password>pwd</v1:Password><Weight>5</Weight>',
        }));

        for (const secret of ['real-token', 'k-123', 'shh', '123456', '>ABC<', '>pwd<', '"abc"']) {
            expect(redacted).not.toContain(secret);
        }
        expect(redacted).toContain('[REDACTED] (empty credentials)');
        expect(redacted).toContain('application/json');
        expect(redacted).toContain('"weight":80');
        expect(redacted).toContain('<Weight>5</Weight>');
    });
});

test.describe('Categorías de Allure', { tag: ['@unit', '@reporting'] }, () => {
    type Category = { name: string; messageRegex?: string };

    function categories(): Category[] {
        const reporters = (config.reporter ?? []) as Array<[string, { categories?: Category[] }]>;
        return reporters.find(([name]) => name === 'allure-playwright')?.[1].categories ?? [];
    }

    /** Allure (Java) uses Pattern.matches → full match; emulate `(?s)` with the "s" flag. */
    function matchingCategories(message: string): string[] {
        return categories()
            .filter((category) => category.messageRegex)
            .filter((category) => new RegExp(`^(?:${category.messageRegex!.replace('(?s)', '')})$`, 's').test(message))
            .map((category) => category.name);
    }

    test('un fallo [CARRIER EXTERNO] cae solo en su categoría, aunque el mensaje tenga 401 o timeout', () => {
        const message = `${CARRIER_FAILURE_TAG} Sin rates disponibles; EasyPost 401 UNAUTHORIZED\n\nTimeoutError: locator.waitFor: Timeout 30000ms exceeded.\n  - waiting for locator('mat-dialog-content div.cursor-pointer')`;
        expect(matchingCategories(message)).toEqual(['Error externo de carrier']);
    });

    test('los fallos sin etiqueta siguen clasificándose como antes', () => {
        expect(matchingCategories('Error: 401 Unauthorized')).toEqual(['Autenticación / sesión']);
        expect(matchingCategories('TimeoutError: waiting for locator(\'#x\')')).toEqual(['Selector desactualizado / elemento no encontrado']);
        expect(matchingCategories('expect(received).toBe(expected)\nExpected: 1\nReceived: 2')).toEqual(['Defecto funcional (assertion)']);
    });
});
