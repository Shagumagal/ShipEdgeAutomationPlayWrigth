/**
 * Commercial invoice EasyPost returns for an international USPS label (`forms[]` →
 * commercial_invoice), read from its PDF text: the text items in reading order, trimmed and without
 * blanks (infrastructure/pdf-text.ts). Pure module — no Playwright.
 *
 * The template is a list of "Label:" items followed by their values:
 *   Sender: <company> <name> <street> <city> <state> <zip> <country> Phone Number: … Email: …
 *   Recipient: … · Tracking Code: … · Quantity … Subtotal Value <lines> Total Net Weight: …
 *   Total Declared Value: (USD) 2.00 · Currency Code: USD · Terms of Trade: DAP - Delivered At Place
 * The invoice prints no tax identifier: the tax id goes on the label (CP72), which is an image.
 */
import { comparable, differences, json, roundCents } from '../mismatches';
import type { EasyPostAddress } from './easypost-label-log';

export interface ExpectedInvoiceLine {
    quantity: number;
    originCountry: string;
    description: string;
    hsCode: string;
    unitValue: number;
}

export interface ExpectedCommercialInvoice {
    sender: EasyPostAddress;
    recipient: EasyPostAddress;
    /** Tracking codes of the shipment boxes: the invoice shows the one of its box. */
    trackingCodes: string[];
    lines: ExpectedInvoiceLine[];
    /** ISO 4217 code of the declared values, e.g. USD. */
    currency: string;
    incoterm: string;
}

/** Columns of one item line: Quantity, Country of Origin, Description, HS Code, Weight, Unit Value, Subtotal. */
const LINE_COLUMNS = 7;
/** Address fields printed in the Sender/Recipient blocks (phone and email have their own labels). */
const PRINTED_ADDRESS_FIELDS = ['name', 'company', 'street1', 'street2', 'city', 'state', 'zip', 'country'] as const;

/** Differences between the invoice text and the shipment. Empty when everything printed matches. */
export function findCommercialInvoiceMismatches(items: string[], expected: ExpectedCommercialInvoice): string[] {
    if (items.length === 0) return ['the commercial invoice PDF has no text'];
    if (!items.some((item) => /^commercial invoice$/i.test(item))) return ['the PDF is not a commercial invoice (no "Commercial Invoice" title)'];

    const problems = [
        ...findPartyMismatches(items, 'Sender:', expected.sender),
        ...findPartyMismatches(items, 'Recipient:', expected.recipient),
    ];

    const tracking = valueAfter(items, 'Tracking Code:');
    if (!tracking || !expected.trackingCodes.includes(tracking)) {
        problems.push(`Tracking Code is ${json(tracking)}, expected one of ${json(expected.trackingCodes)}`);
    }

    problems.push(...findLineMismatches(items, expected));

    const declared = valueAfter(items, 'Total Declared Value:');
    const expectedDeclared = roundCents(expected.lines.reduce((sum, line) => sum + line.quantity * line.unitValue, 0));
    if (Number(declared) !== expectedDeclared) {
        problems.push(`Total Declared Value is ${json(declared)}, expected ${money(expectedDeclared)}`);
    }
    problems.push(...differences([['Currency Code', valueAfter(items, 'Currency Code:'), expected.currency]]));

    const terms = valueAfter(items, 'Terms of Trade:');
    if (!terms?.toUpperCase().startsWith(`${expected.incoterm.toUpperCase()} -`)) {
        problems.push(`Terms of Trade is ${json(terms)}, expected "${expected.incoterm} - …"`);
    }
    return problems;
}

/** The block after `label` up to its "Phone Number:" holds the address; phone and email follow. */
function findPartyMismatches(items: string[], label: string, expected: EasyPostAddress): string[] {
    const start = items.indexOf(label);
    if (start < 0) return [`the invoice has no "${label}" block`];

    const phoneAt = items.indexOf('Phone Number:', start);
    const block = items.slice(start + 1, phoneAt < 0 ? undefined : phoneAt).map(comparable);
    const party = label.replace(':', '');
    const problems = PRINTED_ADDRESS_FIELDS
        .filter((field) => expected[field])
        .filter((field) => !block.includes(comparable(expected[field])))
        .map((field) => `${party} has no ${field} "${expected[field]}" (block: ${json(items.slice(start + 1, phoneAt))})`);

    for (const [field, label] of [['phone', 'Phone Number:'], ['email', 'Email:']] as const) {
        const printed = valueAfter(items, label, start);
        if (expected[field] && comparable(printed) !== comparable(expected[field])) {
            problems.push(`${party} ${field} is ${json(printed)}, expected "${expected[field]}"`);
        }
    }
    return problems;
}

/**
 * Item lines sit between the table header (ending in "Value") and "Total Net Weight:". Each
 * expected line must match its own row, and no row may be left over (extra or duplicated products).
 */
function findLineMismatches(items: string[], expected: ExpectedCommercialInvoice): string[] {
    const headerEnd = items.findIndex((item, index) => item === 'Value' && items[index - 1] === 'Subtotal');
    const tableEnd = items.indexOf('Total Net Weight:', headerEnd);
    if (headerEnd < 0 || tableEnd < 0) return ['the invoice has no item table (Quantity … Subtotal Value … Total Net Weight:)'];

    const cells = items.slice(headerEnd + 1, tableEnd);
    const problems: string[] = [];
    if (cells.length % LINE_COLUMNS !== 0) {
        problems.push(`the item table has ${cells.length} cells: not whole lines of ${LINE_COLUMNS} columns`);
    }
    // One to one: each expected line takes its own printed row; whatever is left was not ordered
    const unmatched: string[][] = [];
    for (let index = 0; index + LINE_COLUMNS <= cells.length; index += LINE_COLUMNS) {
        unmatched.push(cells.slice(index, index + LINE_COLUMNS));
    }

    for (const line of expected.lines) {
        const index = unmatched.findIndex((candidate) => candidate[3] === line.hsCode);
        if (index < 0) {
            problems.push(`the invoice has no item line with HS code ${line.hsCode} (lines: ${json(cells)})`);
            continue;
        }
        const [quantity, origin, description, , , unitValue, subtotal] = unmatched.splice(index, 1)[0];
        const wanted: Array<[string, string, string]> = [
            ['quantity', quantity, String(line.quantity)],
            ['country of origin', origin, line.originCountry],
            ['description', description, line.description],
            ['unit value', unitValue, `${money(line.unitValue)} ${expected.currency}`],
            ['subtotal', subtotal, `${money(line.quantity * line.unitValue)} ${expected.currency}`],
        ];
        for (const [field, actual, value] of wanted) {
            if (comparable(actual) !== comparable(value)) {
                problems.push(`item ${line.hsCode}: ${field} is ${json(actual)}, expected "${value}"`);
            }
        }
    }
    problems.push(...unmatched.map((row) => `the invoice has an unexpected item line: ${json(row)}`));
    return problems;
}

/**
 * The value printed after `label` (from `from` on), skipping a currency marker such as "(USD)".
 * Null when the label is missing or followed by another label (an empty field, e.g. "Invoice Number:").
 */
function valueAfter(items: string[], label: string, from = 0): string | null {
    const at = items.indexOf(label, from);
    if (at < 0) return null;
    const value = items.slice(at + 1).find((item) => !/^\(\w{3}\)$/.test(item));
    return value === undefined || value.endsWith(':') ? null : value;
}

function money(value: number): string {
    return roundCents(value).toFixed(2);
}
