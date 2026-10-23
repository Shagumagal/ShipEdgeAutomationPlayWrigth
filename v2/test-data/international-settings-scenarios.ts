import type { ExpectedCommercialInvoice } from '../domain/carriers/easypost-commercial-invoice';
import { toEasyPostAddress, type ExpectedEasyPostLabel } from '../domain/carriers/easypost-label-log';
import type { ApiCustomsData, ApiMerchant } from '../domain/orders/api-order';
import type { InternationalRecipient } from '../domain/orders/order-data';
import type { DomesticPackagePlan } from '../domain/packages/domestic-package-plan';
import type { InternationalSettings } from '../domain/shipments/international-settings';
import { InternationalRecipients } from './generators';

/**
 * US sender of the international orders. The warehouse address cannot be trusted for customs:
 * qa22's has an email in the zip, and EasyPost then returns no rate for the shipment.
 */
export const UsMerchant: ApiMerchant = {
    name: 'QA Automation',
    company: 'QA Automation',
    email: 'test@send.com',
    phone: '4155550100',
    address1: '106 Capitola Dr',
    city: 'Durham',
    state: 'NC',
    zip: '27713',
    country: 'US',
};

/** One box with one customs line: HS code, origin US, price and weight above zero. */
export const CustomsPackagePlan: DomesticPackagePlan = {
    box: { qty: '1', weight: '10.5', length: '12', width: '8', height: '2' },
    item: { sku: 'QA-INTL-HS-1', qty: '2', unitPrice: '1', weight: '5', length: '4', width: '4', height: '1', country: 'US' },
};

export const CustomsData: ApiCustomsData = {
    currency: 'USD',
    contentsType: 'merchandise',
    itemDescription: 'QA customs item',
    harmonizationCode: '1234567890',
};

export interface InternationalSettingsScenario {
    /** Test case id, also the --grep handle. */
    id: string;
    destination: string;
    recipient: InternationalRecipient;
    settings: InternationalSettings;
}

/**
 * One scenario per destination rule: an EU destination takes an IOSS number (IM + 10 digits), the
 * UK a UK VAT number (GB + 9 digits). Both go as tax id type VAT, the only one USPS accepts.
 * Add a destination here and the spec runs it.
 */
export const InternationalSettingsScenarios: readonly InternationalSettingsScenario[] = [
    {
        id: 'TC-Xenvio-IntlSettings-001',
        destination: 'EU (France) with an IOSS number',
        recipient: InternationalRecipients.france,
        settings: {
            generalPurpose: 'sale_permanent',
            currency: 'USD',
            incoterm: 'DAP',
            taxIdentifiers: { entity: 'SENDER', taxId: 'IM2500000123', taxIdType: 'VAT', issuingCountry: 'FR' },
        },
    },
    {
        id: 'TC-Xenvio-IntlSettings-002',
        destination: 'UK with a UK VAT number',
        // Address 2 goes to the carrier as is: "N/A" would be printed on the label
        recipient: { ...InternationalRecipients.uk, address2: '' },
        settings: {
            generalPurpose: 'sale_permanent',
            currency: 'USD',
            incoterm: 'DAP',
            taxIdentifiers: { entity: 'SENDER', taxId: 'GB123456789', taxIdType: 'VAT', issuingCountry: 'GB' },
        },
    },
];

/** What EasyPost must receive for the label of a scenario (sent by Xenvio and kept in its answer). */
export function expectedEasyPostLabel({ recipient, settings }: InternationalSettingsScenario): ExpectedEasyPostLabel {
    const { item } = CustomsPackagePlan;
    return {
        recipient: toEasyPostAddress(recipient),
        sender: toEasyPostAddress(UsMerchant),
        incoterm: settings.incoterm,
        taxIdentifiers: settings.taxIdentifiers,
        contentsType: CustomsData.contentsType,
        customsItems: [{
            hsTariffNumber: CustomsData.harmonizationCode,
            originCountry: item.country,
            quantity: Number(item.qty),
            value: Number(item.qty) * Number(item.unitPrice),
        }],
    };
}

/** What the commercial invoice of a scenario must print; `trackingCodes` are those of its boxes. */
export function expectedCommercialInvoice(scenario: InternationalSettingsScenario, trackingCodes: string[]): ExpectedCommercialInvoice {
    const { recipient, sender, incoterm, customsItems } = expectedEasyPostLabel(scenario);
    return {
        sender,
        recipient,
        trackingCodes,
        lines: customsItems.map((line) => ({
            quantity: line.quantity,
            originCountry: line.originCountry,
            description: CustomsData.itemDescription,
            hsCode: line.hsTariffNumber,
            unitValue: Number(CustomsPackagePlan.item.unitPrice),
        })),
        currency: CustomsData.currency,
        incoterm,
    };
}
