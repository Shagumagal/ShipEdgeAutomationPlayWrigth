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

    test.describe('isRetryableReturnLabelError — tolerant 1008 detection', () => {
        const retryable: [string, unknown][] = [
            ['number', 1008],
            ['string plano', '1008'],
            ['object with numeric code', { code: 1008 }],
            ['objeto con code string', { code: '1008', message: 'Return label not ready' }],
            ['objeto con error_code', { error_code: '1008' }],
            ['objeto anidado', { error: { code: 1008 } }],
            ['string con JSON (mismo formato que el error real)', 'carrier response error: {"errors":[{"error_code":"1008","error_message":"Try again"}]}'],
            ['string con JSON escapado', '{\\"error_code\\":\\"1008\\"}'],
            ['texto libre "Error 1008"', 'Error 1008: return label is still being generated'],
            ['texto libre "code: 1008"', 'failed with code: 1008'],
            ['uppercase', 'ERROR_CODE=1008'],
        ];
        for (const [name, error] of retryable) {
            test(`reintenta: ${name}`, () => {
                expect(isRetryableReturnLabelError(error)).toBe(true);
            });
        }

        const notRetryable: [string, unknown][] = [
            ['error real del carrier 800000', REAL_CARRIER_ERROR_800000],
            ['el mismo error real como body completo', { error: REAL_CARRIER_ERROR_800000 }],
            ['another numeric code', { code: 1009 }],
            ['code that merely contains 1008 (10080)', { code: 10080 }],
            ['code ending in 1008 (21008)', { error_code: '21008' }],
            ['UUID con segmento 1008 (sin falso positivo)', '{"error_reference_id":"aaaaaaaa-1008-4587-b518-262fbb854cde","error_code":"800000"}'],
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
            ['generic timeout', 'Request timeout'],
        ];
        for (const [name, error] of notRetryable) {
            test(`NO reintenta: ${name}`, () => {
                expect(isRetryableReturnLabelError(error)).toBe(false);
            });
        }

        test('the list of retryable codes is configurable', () => {
            expect(isRetryableReturnLabelError({ code: 1009 }, ['1008', '1009'])).toBe(true);
        });
    });

    test.describe('shouldRetryReturnLabel', () => {
        test('retries with 1008 and no return label', () => {
            expect(shouldRetryReturnLabel(null, { code: 1008 })).toBe(true);
        });

        test('does NOT retry the real 800000 error even without a return label', () => {
            expect(shouldRetryReturnLabel(null, REAL_CARRIER_ERROR_800000)).toBe(false);
        });

        test('does not retry when the return label arrived despite an error', () => {
            expect(shouldRetryReturnLabel({ shipments: [] }, { code: 1008 })).toBe(false);
        });

        test('does not retry when there was no error', () => {
            expect(shouldRetryReturnLabel(null, null)).toBe(false);
        });
    });

    test.describe('describeReturnLabelError', () => {
        test('real error: carrier code + message (it used to print "unknown")', () => {
            expect(describeReturnLabelError(REAL_CARRIER_ERROR_800000))
                .toBe('800000 (The is_return_label specified is invalid.)');
            expect(extractReturnLabelErrorCode(REAL_CARRIER_ERROR_800000)).toBe('800000');
            expect(extractReturnLabelErrorMessage(REAL_CARRIER_ERROR_800000))
                .toBe('The is_return_label specified is invalid.');
        });

        test('the same error inside the body (escaped JSON) gives the same result', () => {
            expect(describeReturnLabelError({ error: REAL_CARRIER_ERROR_800000 }))
                .toBe('800000 (The is_return_label specified is invalid.)');
        });

        test('object with code and message', () => {
            expect(describeReturnLabelError({ code: 1008, message: 'Return label not ready' }))
                .toBe('1008 (Return label not ready)');
        });

        test('code only', () => {
            expect(describeReturnLabelError({ code: 1008 })).toBe('1008');
            expect(describeReturnLabelError(1008)).toBe('1008');
        });

        test('free text is returned as is (trimmed)', () => {
            expect(describeReturnLabelError('Request timeout')).toBe('Request timeout');
            expect(describeReturnLabelError('x'.repeat(500))).toHaveLength(200);
        });

        test('falls back to "unknown" without information', () => {
            expect(describeReturnLabelError(null)).toBe('unknown');
            expect(describeReturnLabelError('')).toBe('unknown');
            expect(describeReturnLabelError({ foo: 'bar' })).toBe('unknown');
        });
    });

    test.describe('isReturnLabelSettled', () => {
        test('keeps waiting while only the main label arrived', () => {
            expect(isReturnLabelSettled({ main: {}, returnLabel: null, returnError: null })).toBe(false);
        });

        test('settles when the return label or an error arrives', () => {
            expect(isReturnLabelSettled({ main: {}, returnLabel: {}, returnError: null })).toBe(true);
            expect(isReturnLabelSettled({ main: null, returnLabel: null, returnError: 'x' })).toBe(true);
        });
    });

    test.describe('selectReturnLabelResponse', () => {
        test('prefers return_label, falls back to the main one, null when there is nothing', () => {
            expect(selectReturnLabelResponse({ id: 'return' }, { id: 'main' })).toEqual({ id: 'return' });
            expect(selectReturnLabelResponse(null, { id: 'main' })).toEqual({ id: 'main' });
            expect(selectReturnLabelResponse(null, null)).toBeNull();
        });
    });

    test.describe('parseReturnLabelResponse', () => {
        test('reads shipment and first box from a complete response', () => {
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

        test('does not break on empty or incomplete responses', () => {
            for (const body of [null, undefined, {}, { shipments: [] }, { shipments: [{}] }, { shipments: [{ boxes: [] }] }]) {
                const result = parseReturnLabelResponse(body);
                expect(result.returnLabelUrl).toBeNull();
                expect(result.forwardLabelUrl).toBeNull();
                expect(result.trackingNumber).toBeNull();
            }
        });

        test('missing tracking or return label stay null', () => {
            expect(parseReturnLabelResponse(sampleResponse({}, { trackingNumber: undefined })).trackingNumber).toBeNull();
            const noReturn = parseReturnLabelResponse(sampleResponse({}, { returnLabel: undefined }));
            expect(noReturn.forwardLabelUrl).toBe(FORWARD_URL);
            expect(noReturn.returnLabelUrl).toBeNull();
        });

        test('an empty string is kept (not turned into null), like the original code', () => {
            expect(parseReturnLabelResponse(sampleResponse({}, { returnLabel: '' })).returnLabelUrl).toBe('');
        });
    });
});

test.describe('LabelEvidenceService.fromReturnLabelResult', { tag: ['@unit', '@labels'] }, () => {

    test('one box with forward and return documents, no retry', () => {
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

    test('records the REAL error that caused the retry, not a fixed "1008"', () => {
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

    test('keeps the expected shipment even when the response is from another one (validation catches it)', () => {
        const evidence = LabelEvidenceService.fromReturnLabelResult(
            'S100_TEST',
            parseReturnLabelResponse(sampleResponse({ shipmentNumber: 'S999_OTRO' })),
            { retried: false, initialReturnLabelError: null, successToastScreenshot: null },
        );
        expect(evidence.shipmentNumber).toBe('S100_TEST');
        expect(evidence.responseShipmentNumber).toBe('S999_OTRO');
    });
});
