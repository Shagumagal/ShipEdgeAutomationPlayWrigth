/**
 * EasyPost label calls of one shipment, read from Xenvio's outgoing log (History → View Requests,
 * `GET /shipments/:id/view_requests2`). For every box Xenvio creates an EasyPost shipment
 * (`POST /v2/shipments`, `reference` = box id) and buys its rate (`POST /v2/shipments/shp_…/buy`);
 * one-call-buy accounts get the label in the create answer. Pure module — no Playwright.
 */
import type { TaxIdentifiers } from '../shipments/international-settings';
import { comparable, differences, json, roundCents } from '../mismatches';
import type { OutgoingRecord } from './carrier-errors';

const CREATE_URL = /\/v2\/shipments\/?$/;
const BUY_URL = /\/v2\/shipments\/(shp_[A-Za-z0-9]+)\/buy\/?$/;
/** EasyPost never echoes a tax id back: it answers this placeholder once it accepted one. */
const EASYPOST_HIDDEN_TAX_ID = 'HIDDEN';

export interface EasyPostLabelExchange {
    boxId: string;
    /** EasyPost shipment id (shp_…), what Xenvio keeps as the box carrier_reference. */
    easyPostShipmentId: string;
    /** Body Xenvio sent to POST /v2/shipments. */
    shipmentRequest: any;
    /** EasyPost shipment after the purchase: selected rate, fees, label and customs forms. */
    purchasedShipment: any;
}

/**
 * The label calls of each box (latest attempt), and what could not be found. A box that was
 * retried keeps only its last purchase, so an earlier failed attempt never passes as the label.
 */
export function findEasyPostLabelExchanges(
    records: OutgoingRecord[],
    boxIds: string[],
): { exchanges: EasyPostLabelExchange[]; missing: string[] } {
    const newestFirst = [...records].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    const creates = newestFirst.filter((record) => isPost(record) && CREATE_URL.test(record.request_url ?? ''));
    const buys = newestFirst.filter((record) => isPost(record) && BUY_URL.test(record.request_url ?? ''));

    const exchanges: EasyPostLabelExchange[] = [];
    const missing: string[] = [];
    for (const boxId of boxIds) {
        const buy = buys.find((record) => referenceOf(record.response_body) === boxId);
        const oneCallBuy = creates.find((record) => referenceOf(record.response_body) === boxId && labelUrlOf(record.response_body));
        const purchase = buy ?? oneCallBuy;
        if (!purchase) {
            missing.push(`box ${boxId} has no EasyPost purchase (POST /v2/shipments/shp_…/buy) in View Requests`);
            continue;
        }

        const purchasedShipment = purchase.response_body as any;
        const easyPostShipmentId = String(purchasedShipment?.id ?? buy?.request_url?.match(BUY_URL)?.[1] ?? '');
        const create = creates.find((record) => (record.response_body as any)?.id === easyPostShipmentId);
        if (!create) {
            missing.push(`box ${boxId} has no EasyPost create call (POST /v2/shipments) for ${easyPostShipmentId}`);
            continue;
        }

        exchanges.push({
            boxId,
            easyPostShipmentId,
            shipmentRequest: shipmentOf(create.request_body),
            purchasedShipment,
        });
    }
    return { exchanges, missing };
}

export interface ExpectedCustomsItem {
    hsTariffNumber: string;
    originCountry: string;
    quantity: number;
    /** Declared value of the line: unit price × quantity. */
    value: number;
}

/** An address as EasyPost takes it (`to_address`, `from_address`). */
export interface EasyPostAddress {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
}

export interface ExpectedEasyPostLabel {
    /** to_address: the customer of the shipment. */
    recipient: EasyPostAddress;
    /** from_address: the merchant of the order. */
    sender: EasyPostAddress;
    incoterm: string;
    taxIdentifiers: TaxIdentifiers;
    /** EasyPost customs `contents_type`, e.g. merchandise. */
    contentsType: string;
    customsItems: ExpectedCustomsItem[];
}

/** An order address (recipient or merchant) as Xenvio must send it to EasyPost. */
export function toEasyPostAddress(party: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}): EasyPostAddress {
    return {
        name: easyPostName(party.name),
        company: party.company,
        street1: party.address1,
        street2: party.address2,
        city: party.city,
        state: party.state,
        zip: party.zip,
        country: party.country,
        phone: party.phone === undefined ? undefined : easyPostPhone(party.phone),
        email: party.email,
    };
}

/**
 * Name as Xenvio sends it to EasyPost: a name without a space gets " ." as a last name
 * (EasyPost MonoboxCarrierRequestMapper): "OrderInternational" goes as "OrderInternational .".
 */
export function easyPostName(name: string): string {
    const trimmed = name.trim();
    return trimmed.includes(' ') ? trimmed : `${trimmed} .`;
}

/**
 * Phone as Xenvio sends it to EasyPost: digits only, the last 10 (EasyPost MonoboxCarrierRequestMapper).
 * A longer international number loses its first digits: 33142685500 (FR) goes as 3142685500.
 */
export function easyPostPhone(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Differences between an EasyPost address and the expected one. Case and surrounding blanks are
 * ignored (EasyPost may capitalize), and an empty value equals a missing one; only the fields the
 * expected address has are compared.
 */
export function findAddressMismatches(actual: any, expected: EasyPostAddress, where: string): string[] {
    if (!actual || typeof actual !== 'object') return [`${where} is missing`];

    return Object.entries(expected)
        .filter(([, value]) => value !== undefined)
        .filter(([field, value]) => comparable(actual[field]) !== comparable(value))
        .map(([field, value]) => `${where}.${field} is ${json(actual[field])}, expected "${value}"`);
}

/**
 * What Xenvio sent to EasyPost for one box: addresses, incoterm, tax identifiers and customs data.
 */
export function findLabelRequestMismatches(request: any, expected: ExpectedEasyPostLabel): string[] {
    if (!request || typeof request !== 'object') return ['the EasyPost request has no body'];

    const sentIdentifiers: any[] = Array.isArray(request.tax_identifiers) ? request.tax_identifiers : [];
    const problems = [
        ...findAddressMismatches(request.to_address, expected.recipient, 'to_address'),
        ...findAddressMismatches(request.from_address, expected.sender, 'from_address'),
        ...differences([
            ['options.incoterm', request.options?.incoterm, expected.incoterm],
            ['tax_identifiers entries', sentIdentifiers.length, 1],
        ]),
        ...taxIdentifierMismatches(sentIdentifiers[0], toEasyPostTaxIdentifier(expected.taxIdentifiers)),
        ...differences([['customs_info.contents_type', request.customs_info?.contents_type, expected.contentsType]]),
    ];

    // One to one: each expected line takes its own sent line; whatever is left was not ordered
    const unmatched: any[] = [...(request.customs_info?.customs_items ?? [])];
    for (const item of expected.customsItems) {
        const index = unmatched.findIndex((candidate) => String(candidate?.hs_tariff_number) === item.hsTariffNumber);
        if (index < 0) {
            problems.push(`customs_items has no line with HS code ${item.hsTariffNumber}`);
            continue;
        }
        const [line] = unmatched.splice(index, 1);
        problems.push(...differences([
            [`customs line ${item.hsTariffNumber}: origin_country`, line.origin_country, item.originCountry],
            [`customs line ${item.hsTariffNumber}: quantity`, Number(line.quantity), item.quantity],
            [`customs line ${item.hsTariffNumber}: value`, Number(line.value), item.value],
        ]));
    }
    problems.push(...unmatched.map((line) => `customs_items has an unexpected line: ${json(line)}`));
    return problems;
}

/**
 * What EasyPost answered after the purchase of one box: it kept the addresses, took the incoterm
 * and the tax id (the id comes back as HIDDEN), returned a label and a commercial invoice, and did
 * it in test mode.
 */
export function findLabelResponseMismatches(
    purchased: any,
    expected: Pick<ExpectedEasyPostLabel, 'recipient' | 'sender' | 'incoterm' | 'taxIdentifiers'>,
): string[] {
    if (!purchased || typeof purchased !== 'object') return ['the EasyPost answer has no body'];

    const problems = [
        ...findAddressMismatches(purchased.to_address, expected.recipient, 'to_address'),
        ...findAddressMismatches(purchased.from_address, expected.sender, 'from_address'),
    ];
    if (purchased.mode !== 'test') {
        problems.push(`mode is ${json(purchased.mode)}, expected "test" (sample label on a test carrier account)`);
    }
    if (!String(purchased.id ?? '').startsWith('shp_')) {
        problems.push(`id is ${json(purchased.id)}, expected an EasyPost shipment id (shp_…)`);
    }
    problems.push(
        ...taxIdentifierMismatches(purchased.tax_identifiers?.[0], {
            ...toEasyPostTaxIdentifier(expected.taxIdentifiers),
            tax_id: EASYPOST_HIDDEN_TAX_ID,
        }),
        ...differences([
            ['options.incoterm', purchased.options?.incoterm, expected.incoterm],
            ['options.delivered_duty_paid', purchased.options?.delivered_duty_paid, expected.incoterm === 'DDP'],
        ]),
    );

    const forms: any[] = purchased.forms ?? [];
    if (!forms.some((form) => form?.form_type === 'commercial_invoice' && form?.form_url)) {
        problems.push(`forms has no commercial_invoice (form types: ${json(forms.map((form) => form?.form_type))})`);
    }
    if (!purchased.postage_label?.label_url) {
        problems.push('postage_label.label_url is empty');
    }
    if (!purchased.tracking_code) {
        problems.push('tracking_code is empty');
    }
    return problems;
}

/**
 * final_postage Xenvio must charge (EasyPostClient): per box, the selected rate plus every fee
 * that was charged, not refunded and is not the PostageFee (the PostageFee is the rate itself).
 * An InsuranceFee counts even when the order asked for no insurance (account setting).
 */
export function expectedFinalPostage(purchasedShipments: any[]): number {
    const total = purchasedShipments.reduce((sum, shipment) => {
        const rate = Number(shipment?.selected_rate?.rate ?? 0);
        const fees = (shipment?.fees ?? [])
            .filter((fee: any) => fee?.charged && !fee?.refunded && fee?.type !== 'PostageFee')
            .reduce((feeSum: number, fee: any) => feeSum + Number(fee.amount), 0);
        return sum + rate + fees;
    }, 0);
    return roundCents(total);
}

/** The tax identifier as Xenvio must send it to EasyPost (snake_case). */
function toEasyPostTaxIdentifier(taxIdentifiers: TaxIdentifiers) {
    return {
        entity: taxIdentifiers.entity,
        tax_id: taxIdentifiers.taxId,
        tax_id_type: taxIdentifiers.taxIdType,
        issuing_country: taxIdentifiers.issuingCountry,
    };
}

function taxIdentifierMismatches(actual: any, wanted: Record<string, string>): string[] {
    return differences(Object.entries(wanted).map(([field, value]) => [`tax_identifiers[0].${field}`, actual?.[field], value]));
}

function isPost(record: OutgoingRecord): boolean {
    return String(record.request_method ?? '').toUpperCase() === 'POST';
}

function referenceOf(body: unknown): string | null {
    const reference = (body as any)?.reference;
    return reference == null ? null : String(reference);
}

function labelUrlOf(body: unknown): string | null {
    return (body as any)?.postage_label?.label_url ?? null;
}

/** Some Xenvio paths log the request wrapped as `{ shipment: {...} }`. */
function shipmentOf(body: unknown): any {
    return (body as any)?.shipment ?? body;
}
