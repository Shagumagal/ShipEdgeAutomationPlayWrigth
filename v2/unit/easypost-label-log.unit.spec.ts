import { test, expect } from '@playwright/test';
import type { OutgoingRecord } from '../domain/carriers/carrier-errors';
import {
    easyPostName,
    easyPostPhone,
    expectedFinalPostage,
    findAddressMismatches,
    findEasyPostLabelExchanges,
    findLabelRequestMismatches,
    findLabelResponseMismatches,
    toEasyPostAddress,
} from '../domain/carriers/easypost-label-log';
import { expectedEasyPostLabel, InternationalRecipients, InternationalSettingsScenarios } from '../test-data';

/** Shaped like the View Requests of a real USPS international label (QA-PROBE-1792685111619-S1, x52). */
const BOX_ID = '6372931';
const SHP = 'shp_44e9522f369a4b1689aa85c98f61c823';

/** Addresses as Xenvio sent them for QA-API-20261022-195447-0k0q-S1 (x5demo1): the phone keeps its last 10 digits. */
const toAddress = {
    name: 'OrderInternational FR', company: 'TestInternational', street1: '24 Rue de Rivoli', street2: null,
    city: 'Paris', state: 'Île-de-France', zip: '75004', country: 'FR', phone: '3142685500', email: 'test@send.com',
};
const fromAddress = {
    name: 'QA Automation', company: 'QA Automation', street1: '106 Capitola Dr', street2: null,
    city: 'Durham', state: 'NC', zip: '27713', country: 'US', phone: '4155550100', email: 'test@send.com',
};

const sentShipment = {
    reference: Number(BOX_ID),
    to_address: toAddress,
    from_address: fromAddress,
    options: { machinable: true, incoterm: 'DAP', currency: 'USD' },
    customs_info: {
        contents_type: 'merchandise',
        customs_items: [{ description: 'l1', quantity: 2, value: 2, weight: 160, origin_country: 'US', hs_tariff_number: '1234567890', currency: 'USD' }],
    },
    carrier_accounts: ['ca_test'],
    tax_identifiers: [{ entity: 'SENDER', tax_id: 'IM2500000123', tax_id_type: 'VAT', issuing_country: 'FR' }],
};

const purchasedShipment = {
    id: SHP,
    mode: 'test',
    to_address: { ...toAddress, street2: '' },
    from_address: fromAddress,
    reference: BOX_ID,
    tracking_code: 'CA005232219US',
    options: { incoterm: 'DAP', delivered_duty_paid: false },
    tax_identifiers: [{ entity: 'SENDER', tax_id: 'HIDDEN', tax_id_type: 'VAT', issuing_country: 'FR' }],
    forms: [{ form_type: 'commercial_invoice', form_url: 'https://easypost-files.test/form.pdf' }],
    postage_label: { label_url: 'https://easypost-files.test/label.pdf' },
    selected_rate: { rate: '114.53', service: 'PriorityMailInternational' },
    fees: [
        { type: 'LabelFee', amount: '0.00000', charged: true, refunded: false },
        { type: 'PostageFee', amount: '114.53000', charged: true, refunded: false },
        { type: 'InsuranceFee', amount: '1.00000', charged: true, refunded: false },
    ],
};

function createCall(overrides: Partial<OutgoingRecord> = {}): OutgoingRecord {
    return {
        request_method: 'POST',
        request_url: 'https://api.easypost.com/v2/shipments',
        request_body: sentShipment,
        response_code: '201',
        response_body: { ...purchasedShipment, selected_rate: null, fees: [], forms: [], postage_label: null, tracking_code: null },
        created_at: '2026-10-22T16:05:58.967Z',
        ...overrides,
    };
}

function buyCall(overrides: Partial<OutgoingRecord> = {}): OutgoingRecord {
    return {
        request_method: 'POST',
        request_url: `https://api.easypost.com/v2/shipments/${SHP}/buy`,
        request_body: { rate: { id: 'rate_1' } },
        response_code: '200',
        response_body: purchasedShipment,
        created_at: '2026-10-22T16:06:00.721Z',
        ...overrides,
    };
}

/** The France scenario: IOSS IM2500000123, DAP, one customs line (HS 1234567890, 2 × $1, origin US). */
const expected = expectedEasyPostLabel(InternationalSettingsScenarios[0]);

test.describe('EasyPost label calls (View Requests)', { tag: ['@unit', '@labels'] }, () => {

    test('pairs the create and the purchase of each box by its reference', () => {
        const { exchanges, missing } = findEasyPostLabelExchanges([buyCall(), createCall()], [BOX_ID]);
        expect(missing).toEqual([]);
        expect(exchanges).toEqual([{ boxId: BOX_ID, easyPostShipmentId: SHP, shipmentRequest: sentShipment, purchasedShipment }]);
    });

    test('a retried box keeps its latest purchase, never the earlier attempt', () => {
        const oldShp = 'shp_old';
        const records = [
            createCall({ created_at: '2026-10-22T15:00:00Z', response_body: { id: oldShp, reference: BOX_ID } }),
            buyCall({ created_at: '2026-10-22T15:00:01Z', request_url: `https://api.easypost.com/v2/shipments/${oldShp}/buy`, response_body: { ...purchasedShipment, id: oldShp } }),
            createCall(),
            buyCall(),
        ];
        expect(findEasyPostLabelExchanges(records, [BOX_ID]).exchanges[0].easyPostShipmentId).toBe(SHP);
    });

    test('a box without a purchase, or another box, is reported as missing', () => {
        expect(findEasyPostLabelExchanges([createCall()], [BOX_ID]).missing)
            .toEqual([`box ${BOX_ID} has no EasyPost purchase (POST /v2/shipments/shp_…/buy) in View Requests`]);
        expect(findEasyPostLabelExchanges([createCall(), buyCall()], ['999']).missing).toHaveLength(1);
    });

    test('one-call-buy accounts get the label in the create answer', () => {
        const oneCall = createCall({ response_body: purchasedShipment });
        const { exchanges, missing } = findEasyPostLabelExchanges([oneCall], [BOX_ID]);
        expect(missing).toEqual([]);
        expect(exchanges[0]).toMatchObject({ easyPostShipmentId: SHP, purchasedShipment });
    });

    test('a request logged as { shipment: {...} } is unwrapped', () => {
        const { exchanges } = findEasyPostLabelExchanges([createCall({ request_body: { shipment: sentShipment } }), buyCall()], [BOX_ID]);
        expect(exchanges[0].shipmentRequest).toBe(sentShipment);
    });
});

test.describe('EasyPost label request', { tag: ['@unit', '@labels'] }, () => {

    test('incoterm, tax identifiers and customs data as saved pass', () => {
        expect(findLabelRequestMismatches(sentShipment, expected)).toEqual([]);
    });

    test('a request without the International Settings fails on every field', () => {
        const withoutSettings = { ...sentShipment, options: { machinable: true }, tax_identifiers: undefined };
        expect(findLabelRequestMismatches(withoutSettings, expected)).toEqual([
            'options.incoterm is null, expected "DAP"',
            'tax_identifiers entries is 0, expected 1',
            'tax_identifiers[0].entity is null, expected "SENDER"',
            'tax_identifiers[0].tax_id is null, expected "IM2500000123"',
            'tax_identifiers[0].tax_id_type is null, expected "VAT"',
            'tax_identifiers[0].issuing_country is null, expected "FR"',
        ]);
    });

    test('customs lines are matched by HS code: origin, quantity and value must match', () => {
        const wrongLine = { ...sentShipment.customs_info.customs_items[0], origin_country: 'CN', value: 1 };
        const request = { ...sentShipment, customs_info: { contents_type: 'gift', customs_items: [wrongLine] } };
        expect(findLabelRequestMismatches(request, expected)).toEqual([
            'customs_info.contents_type is "gift", expected "merchandise"',
            'customs line 1234567890: origin_country is "CN", expected "US"',
            'customs line 1234567890: value is 1, expected 2',
        ]);
        expect(findLabelRequestMismatches({ ...sentShipment, customs_info: { contents_type: 'merchandise', customs_items: [] } }, expected))
            .toEqual(['customs_items has no line with HS code 1234567890']);
    });
});

test.describe('EasyPost customs lines', { tag: ['@unit', '@labels'] }, () => {

    const [line] = sentShipment.customs_info.customs_items;
    const withLines = (...lines: object[]) => ({ ...sentShipment, customs_info: { contents_type: 'merchandise', customs_items: lines } });

    test('a duplicated line fails: each expected line takes exactly one sent line', () => {
        expect(findLabelRequestMismatches(withLines(line, line), expected))
            .toEqual([`customs_items has an unexpected line: ${JSON.stringify(line)}`]);
    });

    test('a line for a product the order does not have fails', () => {
        const extra = { ...line, description: 'Extra', hs_tariff_number: '9999999999' };
        expect(findLabelRequestMismatches(withLines(line, extra), expected))
            .toEqual([`customs_items has an unexpected line: ${JSON.stringify(extra)}`]);
    });

    test('two expected lines with the same HS code need two sent lines', () => {
        const twoLines = { ...expected, customsItems: [...expected.customsItems, ...expected.customsItems] };
        expect(findLabelRequestMismatches(withLines(line), twoLines)).toEqual(['customs_items has no line with HS code 1234567890']);
        expect(findLabelRequestMismatches(withLines(line, line), twoLines)).toEqual([]);
    });
});

test.describe('EasyPost addresses', { tag: ['@unit', '@labels'] }, () => {

    test('the order addresses map to what Xenvio sends: street1/2, phone with its last 10 digits', () => {
        expect(toEasyPostAddress(InternationalRecipients.france)).toMatchObject({ street1: '24 Rue de Rivoli', phone: '3142685500', country: 'FR' });
        expect(easyPostPhone('+33 1 42 68 55 00')).toBe('3142685500');
        expect(easyPostPhone('(415) 555-0100')).toBe('4155550100');
    });

    test('a one-word name gets " ." as a last name; a full name goes as is', () => {
        expect(easyPostName('OrderInternational')).toBe('OrderInternational .');
        expect(easyPostName(' OrderInternational FR ')).toBe('OrderInternational FR');
        expect(toEasyPostAddress(InternationalRecipients.uk).name).toBe('OrderInternational .');
    });

    test('case, blanks and empty-vs-missing do not count; a different value does', () => {
        const shouted = { ...toAddress, state: 'ÎLE-DE-FRANCE', city: ' paris ', street2: '' };
        expect(findAddressMismatches(shouted, expected.recipient, 'to_address')).toEqual([]);
        expect(findAddressMismatches({ ...toAddress, zip: '75001', phone: '33142685500' }, expected.recipient, 'to_address')).toEqual([
            'to_address.zip is "75001", expected "75004"',
            'to_address.phone is "33142685500", expected "3142685500"',
        ]);
        expect(findAddressMismatches(undefined, expected.recipient, 'to_address')).toEqual(['to_address is missing']);
    });

    test('a request or answer with sender and recipient swapped fails both ways', () => {
        const swapped = { ...sentShipment, to_address: fromAddress, from_address: toAddress };
        const problems = findLabelRequestMismatches(swapped, expected);
        expect(problems.some((problem) => problem.startsWith('to_address.country is "US"'))).toBe(true);
        expect(problems.some((problem) => problem.startsWith('from_address.country is "FR"'))).toBe(true);
        expect(findLabelResponseMismatches({ ...purchasedShipment, to_address: fromAddress }, expected)).toContain('to_address.zip is "27713", expected "75004"');
    });
});

test.describe('EasyPost label answer', { tag: ['@unit', '@labels'] }, () => {

    test('a test-mode purchase with the tax id HIDDEN, the incoterm, a label and a commercial invoice passes', () => {
        expect(findLabelResponseMismatches(purchasedShipment, expected)).toEqual([]);
    });

    test('the tax id must come back hidden: an echoed or missing id means EasyPost did not take it', () => {
        const echoed = { ...purchasedShipment, tax_identifiers: [{ ...purchasedShipment.tax_identifiers[0], tax_id: 'IM2500000123' }] };
        expect(findLabelResponseMismatches(echoed, expected)).toEqual(['tax_identifiers[0].tax_id is "IM2500000123", expected "HIDDEN"']);
        expect(findLabelResponseMismatches({ ...purchasedShipment, tax_identifiers: [] }, expected)).toHaveLength(4);
    });

    test('a production purchase, no customs form or no label fail', () => {
        const problems = findLabelResponseMismatches({
            ...purchasedShipment,
            mode: 'production',
            forms: [{ form_type: 'cn22', form_url: 'x' }],
            postage_label: { label_url: '' },
        }, expected);
        expect(problems).toEqual([
            'mode is "production", expected "test" (sample label on a test carrier account)',
            'forms has no commercial_invoice (form types: ["cn22"])',
            'postage_label.label_url is empty',
        ]);
    });

    test('DAP is not duty paid; DDP is', () => {
        const ddp = { ...purchasedShipment, options: { incoterm: 'DDP', delivered_duty_paid: true } };
        expect(findLabelResponseMismatches(ddp, { ...expected, incoterm: 'DDP' })).toEqual([]);
        expect(findLabelResponseMismatches({ ...purchasedShipment, options: { incoterm: 'DAP', delivered_duty_paid: true } }, expected))
            .toEqual(['options.delivered_duty_paid is true, expected false']);
    });
});

test.describe('Final postage', { tag: ['@unit', '@labels'] }, () => {

    test('selected rate plus the InsuranceFee, without counting the PostageFee twice (order 319: 115.53)', () => {
        expect(expectedFinalPostage([purchasedShipment])).toBe(115.53);
    });

    test('refunded or uncharged fees do not count; boxes add up', () => {
        const box2 = {
            selected_rate: { rate: '10.10' },
            fees: [
                { type: 'InsuranceFee', amount: '1.00', charged: false, refunded: false },
                { type: 'LabelFee', amount: '0.50', charged: true, refunded: true },
                { type: 'CarbonOffsetFee', amount: '0.20', charged: true, refunded: false },
            ],
        };
        expect(expectedFinalPostage([purchasedShipment, box2])).toBe(125.83);
    });
});
