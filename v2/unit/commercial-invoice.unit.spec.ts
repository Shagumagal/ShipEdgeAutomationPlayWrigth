import { test, expect } from '@playwright/test';
import { findCommercialInvoiceMismatches } from '../domain/carriers/easypost-commercial-invoice';
import { expectedCommercialInvoice, InternationalSettingsScenarios } from '../test-data';
import { COMMERCIAL_INVOICE_ITEMS } from './fixtures/commercial-invoice-sample';

/** The France scenario, whose real invoice is the sample. */
const expected = expectedCommercialInvoice(InternationalSettingsScenarios[0], ['CM000005042US']);

/** The sample with one printed value replaced. */
function printedWith(original: string, replacement: string, occurrence = 0): string[] {
    const items = [...COMMERCIAL_INVOICE_ITEMS];
    const indexes = items.flatMap((item, index) => (item === original ? [index] : []));
    items[indexes[occurrence]] = replacement;
    return items;
}

test.describe('EasyPost commercial invoice', { tag: ['@unit', '@labels'] }, () => {

    test('the real invoice of a France shipment matches its order', () => {
        expect(findCommercialInvoiceMismatches([...COMMERCIAL_INVOICE_ITEMS], expected)).toEqual([]);
    });

    test('a recipient field printed differently is reported in its block, not found in the sender one', () => {
        const problems = findCommercialInvoiceMismatches(printedWith('75004', '75001'), expected);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/^Recipient has no zip "75004"/);
        expect(findCommercialInvoiceMismatches(printedWith('Durham', 'Paris'), expected)[0]).toMatch(/^Sender has no city "Durham"/);
    });

    test('phones are checked per party, as Xenvio sends them (last 10 digits)', () => {
        expect(findCommercialInvoiceMismatches(printedWith('3142685500', '33142685500'), expected))
            .toEqual(['Recipient phone is "33142685500", expected "3142685500"']);
    });

    test('tracking code of another shipment, wrong declared value, currency or incoterm fail', () => {
        expect(findCommercialInvoiceMismatches(printedWith('CM000005042US', 'CM999'), expected))
            .toEqual(['Tracking Code is "CM999", expected one of ["CM000005042US"]']);
        expect(findCommercialInvoiceMismatches(printedWith('2.00', '20.00'), expected))
            .toEqual(['Total Declared Value is "20.00", expected 2.00']);
        expect(findCommercialInvoiceMismatches(printedWith('DAP - Delivered At Place', 'DDP - Delivered Duty Paid'), expected))
            .toEqual(['Terms of Trade is "DDP - Delivered Duty Paid", expected "DAP - …"']);
        expect(findCommercialInvoiceMismatches(printedWith('USD', 'EUR', 1), expected))
            .toEqual(['Currency Code is "EUR", expected "USD"']);
    });

    test('the customs line is matched by HS code and checked column by column', () => {
        expect(findCommercialInvoiceMismatches(printedWith('QA customs item', 'Other item'), expected))
            .toEqual(['item 1234567890: description is "Other item", expected "QA customs item"']);
        expect(findCommercialInvoiceMismatches(printedWith('1.00 USD', '1.50 USD'), expected))
            .toEqual(['item 1234567890: unit value is "1.50 USD", expected "1.00 USD"']);
        expect(findCommercialInvoiceMismatches(printedWith('1234567890', '9999999999'), expected)[0])
            .toMatch(/^the invoice has no item line with HS code 1234567890/);
    });

    test('an extra product or a duplicated line in the item table fails (one row per expected line)', () => {
        const items = [...COMMERCIAL_INVOICE_ITEMS];
        const firstRow = items.indexOf('Value') + 1;
        const row = items.slice(firstRow, firstRow + 7);
        const withRows = (...rows: string[][]) => [...items.slice(0, firstRow + 7), ...rows.flat(), ...items.slice(firstRow + 7)];

        expect(findCommercialInvoiceMismatches(withRows(['1', 'CN', 'Extra product', '9999999999', '1.00 lbs', '5.00 USD', '5.00 USD']), expected))
            .toContain('the invoice has an unexpected item line: ["1","CN","Extra product","9999999999","1.00 lbs","5.00 USD","5.00 USD"]');
        expect(findCommercialInvoiceMismatches(withRows(row), expected))
            .toContain(`the invoice has an unexpected item line: ${JSON.stringify(row)}`);
        expect(findCommercialInvoiceMismatches(withRows(['1', 'US']), expected))
            .toContain('the item table has 9 cells: not whole lines of 7 columns');
    });

    test('an empty PDF (a picture) or another document is never taken as a valid invoice', () => {
        expect(findCommercialInvoiceMismatches([], expected)).toEqual(['the commercial invoice PDF has no text']);
        expect(findCommercialInvoiceMismatches(['Packing Slip', 'Sender:'], expected))
            .toEqual(['the PDF is not a commercial invoice (no "Commercial Invoice" title)']);
    });
});
