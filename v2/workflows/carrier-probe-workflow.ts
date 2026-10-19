import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../evidence/allure-helper';
import {
    entryTitle,
    labelGuard,
    newProbeRecord,
    pickMatchingRate,
    type CarrierMatrixEntry,
    type CarrierMatrixMode,
    type CarrierProbeRecord,
    type ProbeStatus,
} from '../domain/carriers/carrier-matrix';
import { stripAnsiCodes } from '../diagnostics/failure-summary';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { LabelService } from '../services/label-service';

export interface CarrierProbeOptions {
    mode: CarrierMatrixMode;
    allowProduction: boolean;
}

/**
 * Probes one carrier matrix entry on an OPEN shipment through Configure Shipment:
 *
 *   select the Ship Code (or Carrier + Ship Method) → read what the panel shows
 *   → GET RATES → find the rate card of that method
 *   → label mode only: select it → SAVE & CONFIRM → GET LABELS → VOID
 *
 * Never throws: every outcome becomes a CarrierProbeRecord, so one test reports exactly one
 * cell of the matrix. The test decides pass/fail from the record's status.
 */
export async function probeCarrierEntry(
    page: Page,
    orderPage: XenvioOrderToLabelPage,
    entry: CarrierMatrixEntry,
    options: CarrierProbeOptions,
): Promise<CarrierProbeRecord> {
    const startedAt = Date.now();
    const record = newProbeRecord(entry, options.mode);
    const finish = (status: ProbeStatus, message: string): CarrierProbeRecord => {
        console.log(`  ${status === 'works' ? '✅' : '⚠️'} ${record.title}: ${status} — ${message}`);
        return { ...record, status, message, durationMs: Date.now() - startedAt };
    };

    // ─── 1. Configure Shipment ───────────────────────────────────────
    try {
        await allure.step(`Configure Shipment: ${entryTitle(entry)}`, async () => {
            const panel = orderPage.configPanel;
            await panel.expandPanel();
            if (entry.kind === 'shipCode') {
                await panel.selectShipCodeExact(entry.shipCode!, entry.occurrence ?? 1);
                await panel.waitForShipMethodFilled();
            } else {
                await panel.selectCarrierExact(entry.carrier!);
                await panel.selectShipMethodExact(entry.method!);
                if (entry.packageType) await panel.selectPackageTypeExact(entry.packageType);
            }

            const shown = await panel.readSelection();
            record.shipCode = shown.shipCode ?? record.shipCode;
            record.carrier = shown.carrier ?? record.carrier;
            record.method = shown.shipMethod ?? record.method;
            record.packageType = shown.packageType ?? record.packageType;
            await allure.attachment('Configure Shipment shows', JSON.stringify(shown, null, 2), 'application/json');
            await AllureHelper.attachScreenShot(page, 'Configure Shipment');
        });
    } catch (error) {
        return finish('config-error', `Configure Shipment could not select ${entryTitle(entry)}: ${firstLine(error)}`);
    }

    if (!record.method) {
        return finish('config-error', 'Configure Shipment shows no Ship Method for this entry, so its rate cannot be identified');
    }

    // The discovered carrier may be unknown (CARRIER_MATRIX_SHIP_CODES); check what the panel shows.
    const refused = labelGuard(options.mode, record.carrier, options.allowProduction);
    if (refused) return finish('skipped', refused);

    // ─── 2. Rates ────────────────────────────────────────────────────
    let offered: { cards: string[]; noRatesMessage: string | null };
    try {
        offered = await allure.step('Get Rates', async () => {
            await orderPage.clickGetRates();
            const rates = await orderPage.ratesModal.readOfferedRates();
            await allure.attachment('Offered rates', JSON.stringify(rates, null, 2), 'application/json');
            await AllureHelper.attachScreenShot(page, 'Offered rates');
            return rates;
        });
    } catch (error) {
        return finish('error', `GET RATES failed: ${firstLine(error)}`);
    }

    record.offeredRates = offered.cards;
    if (offered.cards.length === 0) {
        return finish('no-rates', offered.noRatesMessage ?? 'No rates were offered for the shipment');
    }

    const index = pickMatchingRate(offered.cards, { carrier: record.carrier, method: record.method });
    if (index === null) {
        return finish('rate-not-offered', `No rate for "${record.method}" among ${offered.cards.length} offered rate(s)`);
    }
    record.rate = offered.cards[index];
    if (options.mode === 'rates') return finish('works', `Rate offered: ${record.rate}`);

    // ─── 3. Label (bought and voided) ────────────────────────────────
    try {
        await allure.step(`Select rate and Save & Confirm: ${record.rate}`, async () => {
            await orderPage.ratesModal.selectRateAt(index);
            await orderPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(page, 'Rate selected and confirmed');
        });

        const label = await LabelService.generate(page, orderPage, 180000);
        record.trackingNumbers = label.labelsByBox.map((box) => box.trackingNumber).filter((tracking): tracking is string => !!tracking);
        record.finalPostage = label.finalPostage;
        record.shipmentLink = label.shipmentLink;
        if (label.labelUrls.length === 0 && record.trackingNumbers.length === 0) {
            return finish('label-failed', 'GET LABELS finished without a label or a tracking number');
        }
    } catch (error) {
        return finish('label-failed', firstLine(error));
    }

    const bought = `tracking ${record.trackingNumbers.join(', ') || 'n/a'}, postage ${record.finalPostage ?? 'n/a'}`;
    try {
        await LabelService.void(page, orderPage);
    } catch (error) {
        return finish('void-failed', `Label bought (${bought}) but VOID failed — void it by hand: ${firstLine(error)}`);
    }
    return finish('works', `Label bought and voided (${bought})`);
}

/** Playwright errors carry ANSI colors and a call log after the first line. */
function firstLine(error: unknown): string {
    const text = stripAnsiCodes(error instanceof Error ? error.message : String(error));
    return text.split('\n').find((line) => line.trim())?.trim().slice(0, 300) ?? 'Unknown error';
}
