/**
 * International Settings of a shipment (Shipper View panel, x5.angular
 * shipper-view/international-settings): what a test fills in and how the backend keeps it.
 * Pure module — no Playwright.
 */
import { differences } from '../mismatches';

/** General Purpose options: backend code (`shipment_type`) → label shown in the select. */
export const GENERAL_PURPOSES = {
    sale_permanent: 'Sale / Permanent',
    gift: 'Gift',
    sample_st: 'Sample',
    repair_warranty: 'Repair / Warranty',
    return: 'Return',
    temporary_export: 'Temporary Export',
    personal_effects: 'Personal Effects',
    documents_only: 'Documents Only',
} as const;

export type GeneralPurpose = keyof typeof GENERAL_PURPOSES;

/** The tax id sent to the carrier (EasyPost `tax_identifiers`). */
export interface TaxIdentifiers {
    entity: 'SENDER' | 'RECEIVER';
    taxId: string;
    /** Code of the Tax ID Type list, e.g. VAT (USPS shows it as "VAT/IOSS"). */
    taxIdType: string;
    /** ISO 3166 alpha-2 code of the country that issued the id. */
    issuingCountry: string;
}

export interface InternationalSettings {
    generalPurpose: GeneralPurpose;
    /** ISO 4217 code, e.g. USD. */
    currency: string;
    /** Incoterm code, e.g. DAP. */
    incoterm: string;
    taxIdentifiers: TaxIdentifiers;
}

/**
 * Differences between a shipment Xenvio answered with (task_executor `shipments[0]`, camelCase)
 * and the settings the test saved. Empty when every field was kept.
 */
export function findSettingsMismatches(shipment: any, expected: InternationalSettings): string[] {
    if (!shipment) return ['the response has no shipment'];

    return [
        ...differences([
            ['General Purpose (shipmentType)', shipment.shipmentType, expected.generalPurpose],
            ['currency', shipment.currencyIsoCode, expected.currency],
        ]),
        ...findServicesMismatches(shipment.services, expected),
    ];
}

/** Differences in the shipment `services` (camelCase): the incoterm and the tax identifiers. */
export function findServicesMismatches(services: any, expected: Pick<InternationalSettings, 'incoterm' | 'taxIdentifiers'>): string[] {
    const saved = services?.taxIdentifiers ?? {};
    const { taxIdentifiers } = expected;
    return differences([
        ['incoterm', services?.incoterm, expected.incoterm],
        ['tax identifier entity', saved.entity, taxIdentifiers.entity],
        ['tax id', saved.taxId, taxIdentifiers.taxId],
        ['tax id type', saved.taxIdType, taxIdentifiers.taxIdType],
        ['tax id issuing country', saved.issuingCountry, taxIdentifiers.issuingCountry],
    ]);
}
