import { test, expect } from '@playwright/test';
import { loadInternationalLabelConfig } from '../config/xenvio-config';
import { validateDomesticPackagePlan } from '../domain/packages/domestic-package-plan';
import { findServicesMismatches, findSettingsMismatches } from '../domain/shipments/international-settings';
import { CustomsPackagePlan, InternationalSettingsScenarios } from '../test-data';

/** The France scenario: DAP, IOSS IM2500000123 issued by FR. */
const { settings } = InternationalSettingsScenarios[0];

/** Shaped like the SAVE & CONFIRM answer of a real shipment (QA-PROBE-1792684377096-S1, x52). */
const savedShipment = {
    shipmentNumber: 'QA-PROBE-1792684377096-S1',
    shipmentType: 'sale_permanent',
    currencyIsoCode: 'USD',
    services: {
        insurance: 0,
        incoterm: 'DAP',
        taxIdentifiers: { entity: 'SENDER', taxId: 'IM2500000123', taxIdType: 'VAT', issuingCountry: 'FR' },
    },
};

test.describe('Saved International Settings', { tag: ['@unit', '@shipment-config'] }, () => {

    test('every field kept passes', () => {
        expect(findSettingsMismatches(savedShipment, settings)).toEqual([]);
    });

    test('a save that dropped the services reports each missing field', () => {
        expect(findSettingsMismatches({ ...savedShipment, services: { insurance: 0 } }, settings)).toEqual([
            'incoterm is null, expected "DAP"',
            'tax identifier entity is null, expected "SENDER"',
            'tax id is null, expected "IM2500000123"',
            'tax id type is null, expected "VAT"',
            'tax id issuing country is null, expected "FR"',
        ]);
    });

    test('general purpose and currency come from the shipment, not from services', () => {
        expect(findSettingsMismatches({ ...savedShipment, shipmentType: 'gift', currencyIsoCode: 'EUR' }, settings)).toEqual([
            'General Purpose (shipmentType) is "gift", expected "sale_permanent"',
            'currency is "EUR", expected "USD"',
        ]);
        expect(findSettingsMismatches(undefined, settings)).toEqual(['the response has no shipment']);
    });

    test('the label result is checked on its services only', () => {
        expect(findServicesMismatches(savedShipment.services, settings)).toEqual([]);
        expect(findServicesMismatches(null, settings)).toHaveLength(5);
    });
});

test.describe('International Settings scenarios', { tag: ['@unit', '@test-data'] }, () => {

    test('ids are unique and each tax id follows its destination rule', () => {
        const ids = InternationalSettingsScenarios.map((scenario) => scenario.id);
        expect(new Set(ids).size).toBe(ids.length);

        const byCountry = Object.fromEntries(InternationalSettingsScenarios.map((scenario) => [scenario.recipient.country, scenario.settings.taxIdentifiers]));
        expect(byCountry.FR.taxId, 'EU: IOSS number, IM + 10 digits').toMatch(/^IM\d{10}$/);
        expect(byCountry.GB.taxId, 'UK: VAT number, GB + 9 digits').toMatch(/^GB\d{9}$/);
        for (const { recipient, settings: { taxIdentifiers } } of InternationalSettingsScenarios) {
            expect(taxIdentifiers.issuingCountry).toBe(recipient.country);
        }
    });

    test('no recipient sends "N/A" as Address 2 (the carrier prints it as is)', () => {
        for (const { recipient } of InternationalSettingsScenarios) {
            expect(recipient.address2 ?? '').not.toMatch(/^n\/?a$/i);
        }
    });

    test('the customs package is consistent: the item fits the box and has price and weight', () => {
        expect(() => validateDomesticPackagePlan(CustomsPackagePlan)).not.toThrow();
    });
});

test.describe('International label setup (.env)', { tag: ['@unit', '@config'] }, () => {

    test('not configured: null, so the test is skipped', () => {
        expect(loadInternationalLabelConfig({})).toBeNull();
    });

    test('warehouse and ship code; the Tax ID carrier group defaults to USPS', () => {
        expect(loadInternationalLabelConfig({ INTL_LABEL_WAREHOUSE: ' qa22 ', INTL_LABEL_SHIP_CODE: 'EUSPMI' }))
            .toEqual({ warehouse: 'qa22', shipCode: 'EUSPMI', taxIdCarrier: 'USPS' });
        expect(loadInternationalLabelConfig({ INTL_LABEL_WAREHOUSE: 'qa22', INTL_LABEL_SHIP_CODE: 'EDHLWW', INTL_LABEL_TAX_ID_CARRIER: 'DHL Express' })?.taxIdCarrier)
            .toBe('DHL Express');
    });

    test('half a configuration is an error, not a silent skip', () => {
        expect(() => loadInternationalLabelConfig({ INTL_LABEL_WAREHOUSE: 'qa22' })).toThrow(/Set both INTL_LABEL_WAREHOUSE and INTL_LABEL_SHIP_CODE/);
    });
});
