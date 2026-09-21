import { test, expect } from '@playwright/test';
import {
    describeReturnLabelError,
    extractReturnLabelErrorCode,
    extractReturnLabelErrorMessage,
    isRetryableReturnLabelError,
    isReturnLabelSettled,
    parseReturnLabelResponse,
    selectReturnLabelResponse,
    shouldRetryReturnLabel,
} from '../parsers/return-label-parser';
import { LabelEvidenceService } from '../evidence';

const FORWARD_URL = 'https://cdn.example.test/labels/forward.pdf';
const RETURN_URL = 'https://cdn.example.test/labels/return.pdf';

/**
 * Real `body.error` value captured from a QA trace (2026-08-06): a STRING with
 * JSON inside. Carrier rejection, deterministic → must NOT be retried.
 */
const REAL_CARRIER_ERROR_800000 =
    'carrier response error: {"error_reference_id":"379d2d1c-16dc-4587-b518-262fbb854cde",' +
    '"errors":[{"error_code":"800000","error_message":"The is_return_label specified is invalid."}]}';

function sampleResponse(overrides: Record<string, unknown> = {}, boxOverrides: Record<string, unknown> = {}) {
    return {
        shipments: [{
            shipmentNumber: 'S100_TEST',
            aasmState: 'shipped',
            isAutoReturnLabel: true,
            finalPostage: 8.45,
            shippingCost: 9.1,
            boxes: [{
                label: FORWARD_URL,
                returnLabel: RETURN_URL,
                trackingNumber: '9400100000000000000001',
                aasmState: 'shipped',
                ...boxOverrides,
            }],
            ...overrides,
        }],
    };
}

test.describe('Return label parser', { tag: ['@unit', '@labels'] }, () => {

    test.describe('isRetryableReturnLabelError — detección tolerante de 1008', () => {
        const retryable: [string, unknown][] = [
            ['número', 1008],
            ['string plano', '1008'],
            ['objeto con code numérico', { code: 1008 }],
            ['objeto con code string', { code: '1008', message: 'Return label not ready' }],
            ['objeto con error_code', { error_code: '1008' }],
            ['objeto anidado', { error: { code: 1008 } }],
            ['string con JSON (mismo formato que el error real)', 'carrier response error: {"errors":[{"error_code":"1008","error_message":"Try again"}]}'],
            ['string con JSON escapado', '{\\"error_code\\":\\"1008\\"}'],
            ['texto libre "Error 1008"', 'Error 1008: return label is still being generated'],
            ['texto libre "code: 1008"', 'failed with code: 1008'],
            ['mayúsculas', 'ERROR_CODE=1008'],
        ];
        for (const [name, error] of retryable) {
            test(`reintenta: ${name}`, () => {
                expect(isRetryableReturnLabelError(error)).toBe(true);
            });
        }

        const notRetryable: [string, unknown][] = [
            ['error real del carrier 800000', REAL_CARRIER_ERROR_800000],
            ['el mismo error real como body completo', { error: REAL_CARRIER_ERROR_800000 }],
            ['otro código numérico', { code: 1009 }],
            ['código que solo contiene 1008 (10080)', { code: 10080 }],
            ['código que termina en 1008 (21008)', { error_code: '21008' }],
            ['UUID con segmento 1008 (sin falso positivo)', '{"error_reference_id":"aaaaaaaa-1008-4587-b518-262fbb854cde","error_code":"800000"}'],
            ['null', null],
            ['undefined', undefined],
            ['string vacío', ''],
            ['timeout genérico', 'Request timeout'],
        ];
        for (const [name, error] of notRetryable) {
            test(`NO reintenta: ${name}`, () => {
                expect(isRetryableReturnLabelError(error)).toBe(false);
            });
        }

        test('la lista de códigos reintentables es configurable', () => {
            expect(isRetryableReturnLabelError({ code: 1009 }, ['1008', '1009'])).toBe(true);
        });
    });

    test.describe('shouldRetryReturnLabel', () => {
        test('reintenta con 1008 y sin return label', () => {
            expect(shouldRetryReturnLabel(null, { code: 1008 })).toBe(true);
        });

        test('NO reintenta el error real 800000 aunque no haya return label', () => {
            expect(shouldRetryReturnLabel(null, REAL_CARRIER_ERROR_800000)).toBe(false);
        });

        test('no reintenta si el return label llegó aunque haya error', () => {
            expect(shouldRetryReturnLabel({ shipments: [] }, { code: 1008 })).toBe(false);
        });

        test('no reintenta si no hubo error', () => {
            expect(shouldRetryReturnLabel(null, null)).toBe(false);
        });
    });

    test.describe('describeReturnLabelError', () => {
        test('error real: código + mensaje del carrier (antes imprimía "unknown")', () => {
            expect(describeReturnLabelError(REAL_CARRIER_ERROR_800000))
                .toBe('800000 (The is_return_label specified is invalid.)');
            expect(extractReturnLabelErrorCode(REAL_CARRIER_ERROR_800000)).toBe('800000');
            expect(extractReturnLabelErrorMessage(REAL_CARRIER_ERROR_800000))
                .toBe('The is_return_label specified is invalid.');
        });

        test('el mismo error dentro del body (JSON escapado) da el mismo resultado', () => {
            expect(describeReturnLabelError({ error: REAL_CARRIER_ERROR_800000 }))
                .toBe('800000 (The is_return_label specified is invalid.)');
        });

        test('objeto con code y message', () => {
            expect(describeReturnLabelError({ code: 1008, message: 'Return label not ready' }))
                .toBe('1008 (Return label not ready)');
        });

        test('solo código', () => {
            expect(describeReturnLabelError({ code: 1008 })).toBe('1008');
            expect(describeReturnLabelError(1008)).toBe('1008');
        });

        test('texto libre se devuelve tal cual (recortado)', () => {
            expect(describeReturnLabelError('Request timeout')).toBe('Request timeout');
            expect(describeReturnLabelError('x'.repeat(500))).toHaveLength(200);
        });

        test('sin información usa "unknown"', () => {
            expect(describeReturnLabelError(null)).toBe('unknown');
            expect(describeReturnLabelError('')).toBe('unknown');
            expect(describeReturnLabelError({ foo: 'bar' })).toBe('unknown');
        });
    });

    test.describe('isReturnLabelSettled', () => {
        test('sigue esperando mientras solo llegó el label principal', () => {
            expect(isReturnLabelSettled({ main: {}, returnLabel: null, returnError: null })).toBe(false);
        });

        test('termina cuando llega el return label o un error', () => {
            expect(isReturnLabelSettled({ main: {}, returnLabel: {}, returnError: null })).toBe(true);
            expect(isReturnLabelSettled({ main: null, returnLabel: null, returnError: 'x' })).toBe(true);
        });
    });

    test.describe('selectReturnLabelResponse', () => {
        test('prefiere return_label, usa el principal como respaldo, null si no hay nada', () => {
            expect(selectReturnLabelResponse({ id: 'return' }, { id: 'main' })).toEqual({ id: 'return' });
            expect(selectReturnLabelResponse(null, { id: 'main' })).toEqual({ id: 'main' });
            expect(selectReturnLabelResponse(null, null)).toBeNull();
        });
    });

    test.describe('parseReturnLabelResponse', () => {
        test('lee shipment y primera caja de una respuesta completa', () => {
            expect(parseReturnLabelResponse(sampleResponse())).toEqual({
                shipmentNumber: 'S100_TEST',
                shipmentState: 'shipped',
                isAutoReturnLabel: true,
                finalPostage: 8.45,
                shippingCost: 9.1,
                forwardLabelUrl: FORWARD_URL,
                returnLabelUrl: RETURN_URL,
                trackingNumber: '9400100000000000000001',
                boxState: 'shipped',
            });
        });

        test('no rompe con respuestas vacías o incompletas', () => {
            for (const body of [null, undefined, {}, { shipments: [] }, { shipments: [{}] }, { shipments: [{ boxes: [] }] }]) {
                const result = parseReturnLabelResponse(body);
                expect(result.returnLabelUrl).toBeNull();
                expect(result.forwardLabelUrl).toBeNull();
                expect(result.trackingNumber).toBeNull();
            }
        });

        test('tracking o return label ausentes quedan en null', () => {
            expect(parseReturnLabelResponse(sampleResponse({}, { trackingNumber: undefined })).trackingNumber).toBeNull();
            const noReturn = parseReturnLabelResponse(sampleResponse({}, { returnLabel: undefined }));
            expect(noReturn.forwardLabelUrl).toBe(FORWARD_URL);
            expect(noReturn.returnLabelUrl).toBeNull();
        });

        test('un string vacío se conserva (no se convierte en null) igual que el código original', () => {
            expect(parseReturnLabelResponse(sampleResponse({}, { returnLabel: '' })).returnLabelUrl).toBe('');
        });
    });
});

test.describe('LabelEvidenceService.fromReturnLabelResult', { tag: ['@unit', '@labels'] }, () => {

    test('una caja con documento forward y return, sin reintento', () => {
        const evidence = LabelEvidenceService.fromReturnLabelResult(
            'S100_TEST',
            parseReturnLabelResponse(sampleResponse()),
            { retried: false, initialReturnLabelError: null, successToastScreenshot: null },
        );

        expect(evidence.shipmentNumber).toBe('S100_TEST');
        expect(evidence.responseShipmentNumber).toBe('S100_TEST');
        expect(evidence.boxes).toHaveLength(1);
        expect(evidence.boxes[0].documents).toEqual([
            { kind: 'forward', url: FORWARD_URL },
            { kind: 'return', url: RETURN_URL },
        ]);
        expect(evidence.details).toEqual({
            isAutoReturnLabel: true,
            retriedReturnLabel: false,
            initialReturnLabelError: null,
            successToastCaptured: false,
        });
    });

    test('registra el error REAL que causó el reintento, no un "1008" fijo', () => {
        const evidence = LabelEvidenceService.fromReturnLabelResult(
            'S100_TEST',
            parseReturnLabelResponse(sampleResponse()),
            {
                retried: true,
                initialReturnLabelError: { code: 1008, message: 'Return label not ready' },
                successToastScreenshot: Buffer.from('png'),
            },
        );
        expect(evidence.details?.retriedReturnLabel).toBe(true);
        expect(evidence.details?.initialReturnLabelError).toBe('1008 (Return label not ready)');
        expect(evidence.details?.successToastCaptured).toBe(true);
    });

    test('conserva el shipment esperado aunque la respuesta sea de otro (la validación lo detecta)', () => {
        const evidence = LabelEvidenceService.fromReturnLabelResult(
            'S100_TEST',
            parseReturnLabelResponse(sampleResponse({ shipmentNumber: 'S999_OTRO' })),
            { retried: false, initialReturnLabelError: null, successToastScreenshot: null },
        );
        expect(evidence.shipmentNumber).toBe('S100_TEST');
        expect(evidence.responseShipmentNumber).toBe('S999_OTRO');
    });
});
