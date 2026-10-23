import { Locator, Page, expect } from "@playwright/test";
import BasePage from "../base-page";
import { GENERAL_PURPOSES, type InternationalSettings } from "../../domain/shipments/international-settings";

/**
 * The component reports its changes 500 ms after the last edit (debounceTime in
 * international-settings.component.ts). SAVE & CONFIRM before that sends the previous values
 * (x52 answered 400 "tax_identifier required fields missing: entity, issuing_country").
 */
const CHANGE_TRACKING_DEBOUNCE_MS = 500;

/**
 * Component: International Settings panel (v2 — PrimeNG)
 *
 * Angular source: x5.angular/src/app/shipper-view/international-settings/. Shown only for
 * international shipments (merchant country ≠ customer country), expanded by default.
 *
 *   - p-select (filterable) for General Purpose, Currency, Incoterms, Tax ID Type, Entity and
 *     Issuing Country; its overlay list has the id `<select id>_list`
 *   - Tax ID Type is grouped by carrier ("USPS" → "VAT/IOSS: …"): the same code exists in
 *     several carriers, so the option is picked inside the carrier group
 *   - Tax ID is a plain input
 *
 * The panel has no save button: changes are tracked (debounced) and persisted by SAVE & CONFIRM
 * (ShipmentConfigurationService.configureInternationalSettings confirms the save).
 */
export class XenvioInternationalSettingsPanel extends BasePage {

    readonly header: Locator;
    readonly region: Locator;
    readonly taxIdInput: Locator;

    constructor(page: Page) {
        super(page);
        this.header = page.getByRole('button', { name: 'International Settings', exact: true });
        this.region = page.getByRole('region', { name: 'International Settings', exact: true });
        this.taxIdInput = this.region.locator('input[formcontrolname="taxId"]');
    }

    /** Expand the panel if collapsed (it only exists for international shipments). */
    async expand(): Promise<void> {
        await this.header.waitFor({ state: 'visible', timeout: 15000 });
        if (!await this.region.isVisible()) {
            await this.click(this.header);
        }
        await this.region.waitFor({ state: 'visible', timeout: 10000 });
        await this.region.scrollIntoViewIfNeeded();
    }

    /**
     * Fill every field the label needs. `taxIdCarrier` is the carrier group of the Tax ID Type
     * list (e.g. "USPS"): the type codes the carrier of the shipment accepts.
     */
    async fill(settings: InternationalSettings, taxIdCarrier: string): Promise<void> {
        const { taxIdentifiers } = settings;
        const generalPurpose = GENERAL_PURPOSES[settings.generalPurpose];

        await this.expand();
        await this.pickOption('generalPurpose', generalPurpose, exactly(generalPurpose));
        await this.pickOption('currency', settings.currency, exactly(settings.currency));
        // "DAP - Delivered at Place", "FR - France"
        await this.pickOption('incoterm', settings.incoterm, startsWith(`${settings.incoterm} - `));
        await this.selectTaxIdType(taxIdCarrier, taxIdentifiers.taxIdType);
        await this.taxIdInput.fill(taxIdentifiers.taxId);
        await expect(this.taxIdInput).toHaveValue(taxIdentifiers.taxId);
        await this.pickOption('entity', taxIdentifiers.entity, exactly(taxIdentifiers.entity));
        await this.pickOption('issuingCountry', taxIdentifiers.issuingCountry, startsWith(`${taxIdentifiers.issuingCountry} - `));
        // No UI signal tells when the change was tracked; the save answer confirms it afterwards.
        await this.page.waitForTimeout(CHANGE_TRACKING_DEBOUNCE_MS * 2);
        console.log(`✅ International Settings filled: ${settings.incoterm}, ${taxIdentifiers.taxIdType} ${taxIdentifiers.taxId} (${taxIdentifiers.entity}, ${taxIdentifiers.issuingCountry})`);
    }

    /** Tax ID Type `code` inside the `carrier` group, e.g. "USPS" → "VAT/IOSS: A Value Added Tax number…". */
    private async selectTaxIdType(carrier: string, code: string): Promise<void> {
        const list = await this.openList('taxIdType', code);
        const group = list.locator('li[data-pc-section="optiongroup"]').filter({ hasText: exactly(carrier) });
        await expect(group, `Tax ID Type has no "${carrier}" carrier group`).toHaveCount(1, { timeout: 5000 });

        // Headers and options are siblings in document order: the options of a group are the ones
        // whose closest preceding header is that group.
        const groupOptions = list.locator(
            'xpath=.//li[@data-pc-section="option"]'
            + `[preceding::li[@data-pc-section="optiongroup"][1][normalize-space()='${carrier}']]`,
        );
        // The code may carry an alias ("VAT/IOSS: …" for VAT). Once selected, the select shows the
        // first option with that value in the whole list (e.g. "VAT: …" of APC), not the clicked one.
        const codeLabel = new RegExp(`^\\s*${escapeRegExp(code)}(/[^:]*)?:`);
        const option = groupOptions.filter({ hasText: codeLabel });
        await this.clickOnlyOption('taxIdType', option, `"${carrier}" ${code}`, codeLabel);
    }

    /** Open a p-select, filter it and click the only option matching `text`. */
    private async pickOption(control: string, filter: string, text: RegExp): Promise<void> {
        const list = await this.openList(control, filter);
        const option = list.locator('li[data-pc-section="option"]').filter({ hasText: text });
        await this.clickOnlyOption(control, option, String(text));
    }

    private async openList(control: string, filter: string): Promise<Locator> {
        const select = this.select(control);
        await this.waitForElementToBeVisible(select, 10000);
        const listId = `${await select.getAttribute('id')}_list`;
        await select.click();

        const list = this.page.locator(`ul[role="listbox"][id="${listId}"]`);
        await list.waitFor({ state: 'visible', timeout: 5000 });
        const filterInput = this.page.locator(`input[role="searchbox"][aria-owns="${listId}"]`);
        if (await filterInput.isVisible()) {
            await filterInput.fill(filter);
        }
        return list;
    }

    /**
     * Exactly one match or fail (a partial match must never pick a neighbour option). The select
     * must then show `shown` (default: the clicked option's text).
     */
    private async clickOnlyOption(control: string, option: Locator, description: string, shown?: RegExp): Promise<void> {
        await expect(option, `${control}: expected exactly one option matching ${description}`).toHaveCount(1, { timeout: 5000 });
        const label = (await option.innerText()).trim();
        await option.click();
        await expect(this.select(control).getByRole('combobox')).toContainText(shown ?? label, { timeout: 5000 });
    }

    private select(control: string): Locator {
        return this.region.locator(`p-select[formcontrolname="${control}"]`);
    }
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactly(text: string): RegExp {
    return new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`);
}

function startsWith(text: string): RegExp {
    return new RegExp(`^\\s*${escapeRegExp(text)}`);
}
