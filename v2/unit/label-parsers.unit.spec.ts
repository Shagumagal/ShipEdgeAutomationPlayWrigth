import { test, expect } from '@playwright/test';
import { parseGetLabelsResponse } from '../parsers/label-result-parser';
import { parseVoidLabelResponse } from '../parsers/void-result-parser';
import { LabelEvidenceService } from '../evidence';

test.describe('parseGetLabelsResponse', { tag: ['@unit', '@labels'] }, () => {

    test('respuesta null devuelve un resultado vacío', () => {
        expect(parseGetLabelsResponse(null)).toEqual({
            finalPostage: null,
            shippingCost: null,
            labelUrls: [],
            docUrls: [],
            labelsByBox: [],
            shipmentState: null,
            orderNumber: null,
            shipmentNumber: null,
        });
    });

    test('multibox: una entrada por caja con índice, tracking y estado', () => {
        const result = parseGetLabelsResponse({
            shipments: [{
                shipmentNumber: 'S200_TEST',
                aasmState: 'shipped',
                finalPostage: 12.5,
                shippingCost: 14,
                order: { orderNumber: 'ORD-1' },
                boxes: [
                    { label: 'https://x.test/b1.pdf', trackingNumber: 'T1', aasmState: 'shipped' },
                    { label: 'https://x.test/b2.pdf', tracking_number: 'T2', aasm_state: 'shipped' },
                ],
            }],
        });

        expect(result.labelsByBox).toEqual([
            { boxIndex: 1, label: 'https://x.test/b1.pdf', returnLabel: undefined, trackingNumber: 'T1', state: 'shipped' },
            { boxIndex: 2, label: 'https://x.test/b2.pdf', returnLabel: undefined, trackingNumber: 'T2', state: 'shipped' },
        ]);
        expect(result.orderNumber).toBe('ORD-1');
        expect(result.shipmentNumber).toBe('S200_TEST');
    });

    test('forward y return label de la misma caja entran a labelUrls sin duplicarse', () => {
        const result = parseGetLabelsResponse({
            shipments: [{ boxes: [{ label: 'https://x.test/fwd.pdf', returnLabel: 'https://x.test/ret.pdf' }] }],
        });
        expect(result.labelUrls).toEqual(['https://x.test/fwd.pdf', 'https://x.test/ret.pdf']);
        expect(result.labelsByBox[0].returnLabel).toBe('https://x.test/ret.pdf');
    });

    test('PDFs de invoice/commercial van a docUrls, no a labels', () => {
        const result = parseGetLabelsResponse({
            shipments: [{
                boxes: [{ label: 'https://x.test/fwd.pdf' }],
                documents: ['https://x.test/commercial_invoice.pdf'],
            }],
        });
        expect(result.docUrls).toEqual(['https://x.test/commercial_invoice.pdf']);
        expect(result.labelUrls).toEqual(['https://x.test/fwd.pdf']);
    });

    test('postage que no es número queda en null', () => {
        const result = parseGetLabelsResponse({ shipments: [{ finalPostage: '8.45', shippingCost: null }] });
        expect(result.finalPostage).toBeNull();
        expect(result.shippingCost).toBeNull();
    });
});

test.describe('parseVoidLabelResponse', { tag: ['@unit', '@labels'] }, () => {

    test('acepta camelCase y snake_case; labelState sale de la primera caja', () => {
        const result = parseVoidLabelResponse({
            shipments: [{
                aasm_state: 'voided',
                shipment_number: 'S300_TEST',
                order: { order_number: 'ORD-3' },
                boxes: [
                    { label_state: 'voided', aasm_state: 'voided', tracking_number: 'T1' },
                    { labelState: 'voided', aasmState: 'voided', trackingNumber: 'T2' },
                ],
            }],
        });

        expect(result.shipmentState).toBe('voided');
        expect(result.shipmentNumber).toBe('S300_TEST');
        expect(result.orderNumber).toBe('ORD-3');
        expect(result.labelState).toBe('voided');
        expect(result.boxesVoidState.map((box) => box.trackingNumber)).toEqual(['T1', 'T2']);
    });

    test('respuesta null devuelve todo vacío', () => {
        expect(parseVoidLabelResponse(null)).toEqual({
            shipmentState: null,
            labelState: null,
            shipmentNumber: null,
            orderNumber: null,
            boxesVoidState: [],
        });
    });
});

test.describe('LabelEvidenceService.fromGetLabelsResult', { tag: ['@unit', '@labels'] }, () => {

    test('convierte cada caja en documentos forward/return sin duplicados', () => {
        const parsed = parseGetLabelsResponse({
            shipments: [{
                shipmentNumber: 'S400_TEST',
                aasmState: 'shipped',
                boxes: [
                    { label: 'https://x.test/b1.pdf', returnLabel: 'https://x.test/r1.pdf', trackingNumber: 'T1' },
                    { label: 'https://x.test/b2.pdf', trackingNumber: 'T2' },
                ],
            }],
        });

        const evidence = LabelEvidenceService.fromGetLabelsResult('S400_TEST', parsed);

        expect(evidence.boxes[0].documents.map((d) => d.kind)).toEqual(['forward', 'return']);
        expect(evidence.boxes[1].documents.map((d) => d.kind)).toEqual(['forward']);
        expect(evidence.boxes.map((box) => box.boxIndex)).toEqual([1, 2]);
    });

    test('tracking ausente queda en null (la captura de evidencia lo rechaza)', () => {
        const parsed = parseGetLabelsResponse({ shipments: [{ boxes: [{ label: 'https://x.test/b1.pdf' }] }] });
        const evidence = LabelEvidenceService.fromGetLabelsResult('S400_TEST', parsed);
        expect(evidence.boxes[0].trackingNumber).toBeNull();
    });
});
