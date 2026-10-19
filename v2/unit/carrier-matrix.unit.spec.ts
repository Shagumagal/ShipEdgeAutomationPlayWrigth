import { test, expect } from '@playwright/test';
import {
    buildCarrierMatrix,
    entrySkipReason,
    entryTitle,
    fallbackProbeRecord,
    isInternationalMethod,
    isProductionLikeCarrier,
    mergeWithPreviousMatrix,
    newProbeRecord,
    pickMatchingRate,
    renderMatrixMarkdown,
    shipCodeEntriesFromList,
    summarizeMatrix,
    type CarrierMatrixEntry,
    type CarrierProbeRecord,
    type ProbeStatus,
} from '../domain/carriers/carrier-matrix';
import { defaultCarrierMatrixFile, loadCarrierMatrixConfig } from '../config/carrier-matrix-config';

const NOW = new Date('2026-10-19T12:00:00Z');

function record(entryId: string, status: ProbeStatus, overrides: Partial<CarrierProbeRecord> = {}): CarrierProbeRecord {
    return { ...fallbackProbeRecord(entryId, entryId, 'rates', status, `${status} message`), ...overrides };
}

test.describe('Carrier matrix — discovery file', { tag: ['@unit', '@carriers'] }, () => {

    test('one entry per ship code, carrying what Configure Shipment filled in', () => {
        const matrix = buildCarrierMatrix('qa20', [
            { shipCode: 'EFEXG', carrier: 'ezFedex Test', method: 'FedEx Ground', packageType: 'Your Packaging' },
        ], [], NOW);

        expect(matrix).toMatchObject({ warehouse: 'qa20', discoveredAt: NOW.toISOString() });
        expect(matrix.entries).toEqual([{
            id: 'code:EFEXG',
            kind: 'shipCode',
            shipCode: 'EFEXG',
            carrier: 'ezFedex Test',
            method: 'FedEx Ground',
            packageType: 'Your Packaging',
            enabled: true,
        }]);
    });

    test('repeated ship codes get an occurrence, so each account is probed on its own', () => {
        const { entries } = buildCarrierMatrix('qa20', [
            { shipCode: 'EUSPMD', carrier: 'RatesUSPS', method: 'Priority Mail', packageType: null },
            { shipCode: 'EUSPMD', carrier: 'RatesUSPS 2', method: 'Priority Mail', packageType: null },
        ], [], NOW);

        expect(entries.map((entry) => [entry.id, entry.occurrence])).toEqual([
            ['code:EUSPMD', undefined],
            ['code:EUSPMD#2', 2],
        ]);
        expect(entries.every((entry) => /Repeated ship code/.test(entry.note ?? ''))).toBe(true);
        expect(entryTitle(entries[1])).toBe('[EUSPMD #2] RatesUSPS 2 · Priority Mail');
    });

    test('carrier + method pairs a ship code covers, and international methods, are disabled', () => {
        const { entries } = buildCarrierMatrix('qa20', [
            { shipCode: 'EFEXG', carrier: 'ezFedex Test', method: 'FedEx Ground', packageType: null },
            { shipCode: 'EFEXI', carrier: 'ezFedex Test', method: 'International Priority', packageType: null },
        ], [
            { carrier: 'ezFedex Test', methods: ['FEDEX_GROUND', 'FedEx 2Day', 'International Economy', 'FedEx 2Day'] },
        ], NOW);

        const byId = new Map(entries.map((entry) => [entry.id, entry]));
        expect(byId.get('code:EFEXI')).toMatchObject({ enabled: false, note: expect.stringMatching(/International/) });
        expect(byId.get('method:ezFedex Test › FEDEX_GROUND')).toMatchObject({ enabled: false, note: 'Covered by ship code EFEXG.' });
        expect(byId.get('method:ezFedex Test › FedEx 2Day')).toMatchObject({ kind: 'carrierMethod', enabled: true });
        expect(byId.get('method:ezFedex Test › International Economy')?.enabled).toBe(false);
        expect(entries.filter((entry) => entry.id === 'method:ezFedex Test › FedEx 2Day')).toHaveLength(1);
    });

    test('running discovery again keeps what QA edited by hand', () => {
        const previous = buildCarrierMatrix('qa20', [
            { shipCode: 'EFEXG', carrier: 'ezFedex', method: 'Ground', packageType: null },
            { shipCode: 'GONE', carrier: 'Old', method: 'Old', packageType: null },
        ], [], NOW);
        previous.entries[0] = { ...previous.entries[0], enabled: false, note: 'Sandbox down until Nov' };

        const next = buildCarrierMatrix('qa20', [
            { shipCode: 'EFEXG', carrier: 'ezFedex', method: 'Ground', packageType: null },
            { shipCode: 'EUSEM', carrier: 'ezUSPS', method: 'Express', packageType: null },
        ], [], NOW);

        const merged = mergeWithPreviousMatrix(next, previous);
        expect(merged.entries.map((entry) => [entry.id, entry.enabled, entry.note])).toEqual([
            ['code:EFEXG', false, 'Sandbox down until Nov'],
            ['code:EUSEM', true, undefined],
        ]);
    });

    test('CARRIER_MATRIX_SHIP_CODES becomes enabled ship code entries, without repeats', () => {
        expect(shipCodeEntriesFromList(' EFEXG, EUSEM,,EFEXG ')).toEqual([
            { id: 'code:EFEXG', kind: 'shipCode', shipCode: 'EFEXG', enabled: true },
            { id: 'code:EUSEM', kind: 'shipCode', shipCode: 'EUSEM', enabled: true },
        ]);
        expect(entryTitle(shipCodeEntriesFromList('EFEXG')[0])).toBe('[EFEXG]');
    });
});

test.describe('Carrier matrix — what runs', { tag: ['@unit', '@carriers'] }, () => {

    const entry = (overrides: Partial<CarrierMatrixEntry>): CarrierMatrixEntry => ({
        id: 'code:X', kind: 'shipCode', shipCode: 'X', enabled: true, ...overrides,
    });

    test('recognizes production-like accounts and international methods', () => {
        for (const name of ['ProductionCarrier_EZ_USPS', 'UPS prod', 'ezProd_FedEx', 'Stamps LIVE']) {
            expect(isProductionLikeCarrier(name), name).toBe(true);
        }
        for (const name of ['ezFedex Test', 'Product Samples USPS', 'RatesUSPS', null]) {
            expect(isProductionLikeCarrier(name), String(name)).toBe(false);
        }
        expect(isInternationalMethod('USPS First Class International')).toBe(true);
        expect(isInternationalMethod('FedEx Ground', 'EFEXG')).toBe(false);
    });

    test('disabled entries are skipped with their note', () => {
        expect(entrySkipReason(entry({ enabled: false, note: 'Covered by ship code EFEXG.' }), 'rates', false))
            .toBe('Covered by ship code EFEXG.');
        expect(entrySkipReason(entry({ enabled: false }), 'rates', false)).toMatch(/Disabled/);
    });

    test('label mode refuses production-like accounts unless allowed; rates mode never buys', () => {
        const production = entry({ carrier: 'ProductionCarrier_EZ_USPS' });
        expect(entrySkipReason(production, 'label', false)).toMatch(/production account/);
        expect(entrySkipReason(production, 'label', true)).toBeNull();
        expect(entrySkipReason(production, 'rates', false)).toBeNull();
    });
});

test.describe('Carrier matrix — matching the rate of a ship method', { tag: ['@unit', '@carriers'] }, () => {

    const cards = [
        'USPS Priority Mail Express $30.15 Oct 20',
        'USPS Priority Mail $8.10 Oct 21',
        'FedEx FedEx Ground $12.34 Oct 23',
    ];

    test('matches ignoring case, spaces and symbols', () => {
        expect(pickMatchingRate(cards, { method: 'FEDEX_GROUND' })).toBe(2);
        expect(pickMatchingRate(cards, { method: 'Priority Mail Express' })).toBe(0);
    });

    test('a shorter method name picks its own card, not a longer method that contains it', () => {
        expect(pickMatchingRate(cards, { method: 'Priority Mail' })).toBe(1);
    });

    test('prefers the card that also names the carrier', () => {
        const twoCarriers = ['ezUSPS Ground Advantage $5.00', 'RatesUSPS Ground Advantage $5.10'];
        expect(pickMatchingRate(twoCarriers, { carrier: 'RatesUSPS', method: 'Ground Advantage' })).toBe(1);
    });

    test('null when the method got no rate or is unknown', () => {
        expect(pickMatchingRate(cards, { method: 'UPS Next Day Air' })).toBeNull();
        expect(pickMatchingRate(cards, { method: '' })).toBeNull();
        expect(pickMatchingRate([], { method: 'FedEx Ground' })).toBeNull();
    });
});

test.describe('Carrier matrix — report', { tag: ['@unit', '@carriers'] }, () => {

    test('problems first, counted, and compared with the previous run of the same mode', () => {
        const summary = summarizeMatrix([
            record('code:A', 'works', { carrier: 'B carrier' }),
            record('code:B', 'label-failed'),
            record('code:C', 'works', { carrier: 'A carrier' }),
            record('code:D', 'skipped'),
        ], [
            record('code:A', 'works'),
            record('code:B', 'works'),
            record('code:C', 'no-rates'),
            record('code:D', 'works'),
        ]);

        expect(summary.records.map((row) => row.entryId)).toEqual(['code:B', 'code:C', 'code:A', 'code:D']);
        expect(summary.counts).toEqual({ works: 2, 'label-failed': 1, skipped: 1 });
        expect(summary.regressions).toEqual([{ title: 'code:B', from: 'works', to: 'label-failed' }]);
        expect(summary.fixed).toEqual([{ title: 'code:C', from: 'no-rates', to: 'works' }]);
    });

    test('markdown table escapes pipes and links the shipment', () => {
        const markdown = renderMatrixMarkdown(summarizeMatrix([
            record('code:A', 'rate-not-offered', {
                shipCode: 'EFEXG',
                carrier: 'ezFedex | Test',
                method: 'FedEx Ground',
                message: 'No rate for "FedEx Ground" among 3 offered rate(s)',
                shipmentNumber: 'QA-API-1-S1',
                shipmentLink: 'https://x/shipper-view?shipment_number=QA-API-1-S1',
            }),
        ]), { warehouse: 'qa20', mode: 'rates', generatedAt: NOW });

        expect(markdown).toContain('# Carrier matrix — qa20 (rates mode)');
        expect(markdown).toContain('⚠️ 1 rate-not-offered');
        expect(markdown).toContain('| ⚠️ rate-not-offered | EFEXG | ezFedex \\| Test | FedEx Ground |');
        expect(markdown).toContain('[QA-API-1-S1](https://x/shipper-view?shipment_number=QA-API-1-S1)');
    });

    test('a test that ended before the probe is still named in the table', () => {
        const markdown = renderMatrixMarkdown(summarizeMatrix([
            fallbackProbeRecord('code:EUSEM', '[EUSEM]', 'rates', 'error', 'Test timeout of 300000ms exceeded.'),
        ]), { warehouse: 'qa20', mode: 'rates', generatedAt: NOW });

        expect(markdown).toContain('| 💥 error | [EUSEM] |  |  | Test timeout of 300000ms exceeded. |  |');
    });

    test('a new record starts from the entry and is not "works" until the probe says so', () => {
        const fresh = newProbeRecord({ id: 'method:A › B', kind: 'carrierMethod', carrier: 'A', method: 'B', enabled: true }, 'label');
        expect(fresh).toMatchObject({ entryId: 'method:A › B', title: 'A · B', mode: 'label', status: 'error', carrier: 'A', method: 'B' });
    });
});

test.describe('Carrier matrix — configuration', { tag: ['@unit', '@carriers'] }, () => {

    test('defaults to rates mode and the warehouse file', () => {
        expect(loadCarrierMatrixConfig({ WAREHOUSE_XENVIO: 'qa20' })).toEqual({
            mode: 'rates',
            file: defaultCarrierMatrixFile('qa20'),
            shipCodes: null,
            allowProduction: false,
        });
        expect(defaultCarrierMatrixFile('qa20')).toMatch(/data[\\/]carrier-matrix[\\/]qa20\.json$/);
    });

    test('reads the CARRIER_MATRIX_* variables and rejects an unknown mode', () => {
        expect(loadCarrierMatrixConfig({
            CARRIER_MATRIX_MODE: 'LABEL',
            CARRIER_MATRIX_FILE: 'x.json',
            CARRIER_MATRIX_SHIP_CODES: 'EFEXG',
            CARRIER_MATRIX_ALLOW_PRODUCTION: '1',
        })).toEqual({ mode: 'label', file: 'x.json', shipCodes: 'EFEXG', allowProduction: true });
        expect(() => loadCarrierMatrixConfig({ CARRIER_MATRIX_MODE: 'buy' })).toThrow(/rates" or "label/);
    });
});
