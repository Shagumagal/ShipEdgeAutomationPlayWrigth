import * as allure from 'allure-js-commons';
import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../evidence/allure-helper';
import { LabelEvidenceService } from '../evidence';
import { ShipmentNavigationService } from '../services';
import { contract } from '../diagnostics/product-contract';
import { loadInternationalLabelConfig } from '../config/xenvio-config';
import { findServicesMismatches, findSettingsMismatches } from '../domain/shipments/international-settings';
import { expectedFinalPostage, findLabelRequestMismatches, findLabelResponseMismatches } from '../domain/carriers/easypost-label-log';
import { findCommercialInvoiceMismatches } from '../domain/carriers/easypost-commercial-invoice';
import {
    CustomsData,
    CustomsPackagePlan,
    expectedCommercialInvoice,
    expectedEasyPostLabel,
    InternationalSettingsScenarios,
    UsMerchant,
} from '../test-data';

/**
 * ─── Xenvio – International Settings reach the carrier (v2 — PrimeNG) ──────────
 *
 * One test per destination in InternationalSettingsScenarios (TC-Xenvio-IntlSettings-001 FR,
 * -002 UK). The order is created through API v3; the Shipper View fills International Settings,
 * saves them and gets the label. Then the label result, the EasyPost request and answer (View
 * Requests), the commercial invoice PDF and the final postage are checked, each as a product
 * contract. The label prints an image, so its content is not checked. See docs/21.
 */
const carrierSetup = loadInternationalLabelConfig();

test.describe('Xenvio Shipper View – International Settings to carrier (v2 PrimeNG)', {
    tag: ['@e2e', '@labels', '@shipment-config', '@international'],
}, () => {
    test.skip(!carrierSetup, 'No international carrier setup: set INTL_LABEL_WAREHOUSE and INTL_LABEL_SHIP_CODE in .env (docs/21-international-settings.md)');

    for (const scenario of InternationalSettingsScenarios) {
        test(`${scenario.id}: International Settings reach EasyPost — ${scenario.destination}`, async ({
            xenvio,
            apiOrders,
            carrierRequests,
            shipmentDocuments,
        }) => {
            const { warehouse, shipCode, taxIdCarrier } = carrierSetup!;
            const { recipient, settings } = scenario;
            const { taxIdentifiers } = settings;

            await AllureHelper.applyTestMetadata({
                displayName: `International Settings to EasyPost — ${scenario.destination}`,
                owner:    'QA Automation Team',
                tags:     ['xenvio', 'international', 'international-settings', 'labels', 'shipment-config', 'e2e', 'v2', 'primeng', 'api-setup'],
                severity: 'critical',
                epic:     'Xenvio',
                feature:  'International Settings (v2 PrimeNG)',
                story:    'Incoterm and tax identifiers saved in the Shipper View reach the carrier with the label',
            });
            await AllureHelper.addRunParameters({
                Destination: `${recipient.city}, ${recipient.country}`,
                Incoterm: settings.incoterm,
                'Tax ID': `${taxIdentifiers.taxIdType} ${taxIdentifiers.taxId} (${taxIdentifiers.entity}, ${taxIdentifiers.issuingCountry})`,
            });

            // ═════════════════════════════════════════════════════════════════
            // Setup (API v3) + Shipper View: International Settings → SAVE & CONFIRM
            // ═════════════════════════════════════════════════════════════════
            const order = await apiOrders.createOpenOrder({
                recipient,
                plan: CustomsPackagePlan,
                warehouse,
                shipCode,
                merchant: UsMerchant,
                customs: CustomsData,
                sampleLabel: true,
            });
            const session = await xenvio.openSession();
            const orderPage = await ShipmentNavigationService.openByUrl(session.page, {
                shipmentNumber: order.shipmentNumber,
                warehouseId: order.warehouseId,
                appId: 0,
            });

            const saved = await session.configuration.configureInternationalSettings(orderPage, settings, taxIdCarrier);
            await contract('intl-settings.save.persisted', () => expect(
                findSettingsMismatches(saved, settings),
                'International Settings stored by SAVE & CONFIRM',
            ).toEqual([]), { shipment: order.shipmentNumber, services: saved.services, expected: settings });

            // ═════════════════════════════════════════════════════════════════
            // GET LABELS + the EasyPost calls behind it
            // ═════════════════════════════════════════════════════════════════
            const label = await session.labels.generate(orderPage);
            // The label PDFs are the proof (attached here); the invoice is attached by its own check
            await LabelEvidenceService.capture(
                session.page,
                orderPage,
                LabelEvidenceService.fromGetLabelsResult(order.shipmentNumber, label),
                { uiProof: 'none' },
            );

            const boxIds = label.labelsByBox.flatMap((box) => (box.boxId === undefined ? [] : [box.boxId]));
            expect(label.shipmentId, 'the label result must carry the shipment id').not.toBeNull();
            expect(boxIds.length, 'every box of the label result must carry its id').toBe(label.labelsByBox.length);
            const { exchanges, missing } = await carrierRequests.easyPostLabelExchanges(label.shipmentId!, boxIds);
            const purchased = exchanges.map((exchange) => exchange.purchasedShipment);
            const invoices = label.documents.filter((document) => document.type === 'invoice');
            const expectedCarrier = expectedEasyPostLabel(scenario);
            await AllureHelper.addRunParameters({
                'EasyPost shipment': exchanges.map((exchange) => exchange.easyPostShipmentId).join(', '),
            });

            // ═════════════════════════════════════════════════════════════════
            // Verify
            // ═════════════════════════════════════════════════════════════════
            await allure.step('Verify the label result', async () => {
                const carrierForms = purchased.flatMap((shipment) => shipment?.forms ?? []).length;
                await contract('intl-settings.label.shipment-result', () => {
                    expect(findServicesMismatches(label.services, settings), 'International Settings after GET LABELS').toEqual([]);
                    expect(label.finalPostage, 'final postage').toBeGreaterThan(0);
                    expect(label.shippingCost, 'shipping cost equals final postage').toBe(label.finalPostage);
                    expect(invoices.length, `commercial invoices kept by Xenvio (EasyPost returned ${carrierForms} form(s))`).toBe(carrierForms);
                    expect(invoices.map((invoice) => invoice.format), 'commercial invoices are PDF').toEqual(invoices.map(() => 'application/pdf'));
                }, { services: label.services, finalPostage: label.finalPostage, shippingCost: label.shippingCost, documents: label.documents, carrierForms });
            });

            await allure.step('Verify the request sent to EasyPost', async () => {
                const problems = [...missing, ...exchanges.flatMap((exchange) => findLabelRequestMismatches(exchange.shipmentRequest, expectedCarrier)
                    .map((problem) => `box ${exchange.boxId}: ${problem}`))];
                await contract('intl-settings.carrier.request', () => expect(problems, 'POST /v2/shipments of every box').toEqual([]),
                    { expected: expectedCarrier, sent: exchanges.map(({ boxId, shipmentRequest }) => ({ boxId, shipmentRequest })) });
            });

            await allure.step('Verify the EasyPost answer', async () => {
                const problems = [...missing, ...exchanges.flatMap((exchange) => findLabelResponseMismatches(exchange.purchasedShipment, expectedCarrier)
                    .map((problem) => `box ${exchange.boxId} (${exchange.easyPostShipmentId}): ${problem}`))];
                await contract('intl-settings.carrier.accepted', () => expect(problems, 'EasyPost answer of every box').toEqual([]),
                    { expected: expectedCarrier, answered: purchased });
            });

            await allure.step('Verify the commercial invoice', async () => {
                const trackingCodes = label.labelsByBox.flatMap((box) => (box.trackingNumber ? [box.trackingNumber] : []));
                const expectedInvoice = expectedCommercialInvoice(scenario, trackingCodes);
                const read: Array<{ document: string; text: string[] }> = [];

                await contract('intl-settings.commercial-invoice.content', async () => {
                    expect(invoices.length, 'commercial invoice documents of the shipment').toBeGreaterThan(0);
                    for (const [index, invoice] of invoices.entries()) {
                        const text = await shipmentDocuments.readPdf(invoice, `Commercial Invoice PDF - ${order.shipmentNumber} - ${index + 1}`);
                        read.push({ document: invoice.name, text });
                        expect(findCommercialInvoiceMismatches(text, expectedInvoice), `printed on ${invoice.name}`).toEqual([]);
                    }
                }, { expected: expectedInvoice, read });
            });

            await allure.step('Verify the final postage', async () => {
                const expectedPostage = expectedFinalPostage(purchased);
                await AllureHelper.addRunParameters({ 'Expected final postage': expectedPostage });
                await contract('intl-settings.final-postage', () => {
                    expect(exchanges.length, 'an EasyPost purchase for every box').toBe(boxIds.length);
                    expect(label.finalPostage, 'final postage = selected rate + charged fees (not PostageFee)').toBeCloseTo(expectedPostage, 2);
                }, {
                    finalPostage: label.finalPostage,
                    expectedPostage,
                    perBox: purchased.map((shipment) => ({ rate: shipment?.selected_rate?.rate, fees: shipment?.fees })),
                });
            });

            console.log(`✅ International Settings reached EasyPost — ${order.shipmentNumber} (${scenario.destination})`);
        });
    }
});
