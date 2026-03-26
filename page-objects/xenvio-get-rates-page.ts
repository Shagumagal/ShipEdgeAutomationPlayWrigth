import { Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Page Object for the Xenvio Get Rates flow.
 *
 * Flow: Shipper View (search shipment) → Shipment detail → Get Rates
 *   1. Fill package dimensions & country
 *   2. Click "Get Rates" to fetch available carriers
 *   3. Browse & select a rate
 *   4. Optionally set hazmat code
 *   5. Confirm (green) or reject (red) the selected rate
 *
 * Data captured: Order details, Shipment details, Selected rate
 */
export class XenvioGetRatesPage extends BasePage {

    constructor(page: Page) {
        super(page);
    }

    // ─── Navigation ─────────────────────────────────────────────────

    /** Click on a shipment row in the shipper-view results table. */
    async clickShipmentRow(shipmentId: string): Promise<void> {
        console.log(`Clicking on shipment: ${shipmentId}`);
        const row = this.page.locator(`td, span, a`).filter({ hasText: shipmentId }).first();
        await this.waitForElementToBeVisible(row);
        await this.click(row);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log(`✅ Shipment ${shipmentId} opened`);
    }

    // ─── Package dimensions ─────────────────────────────────────────

    /**
     * Fill the package dimensions in the Get Rates form.
     * Inputs are mat-form-field inputs for qty, L, W, H, weight.
     */
    async fillPackageDimensions(dimensions: {
        qty: string;
        length: string;
        width: string;
        height: string;
        weight: string;
    }): Promise<void> {
        console.log('Filling package dimensions...');
        await this.page.waitForTimeout(1000);

        const allInputs = this.page.locator('mat-form-field input.mat-mdc-input-element');
        const inputCount = await allInputs.count();
        console.log(`  Found ${inputCount} dimension inputs`);

        const values = [dimensions.qty, dimensions.length, dimensions.width, dimensions.height, dimensions.weight];
        const labels = ['qty', 'length', 'width', 'height', 'weight'];
        const startIndex = Math.max(0, inputCount - values.length);

        for (let i = 0; i < values.length; i++) {
            const input = allInputs.nth(startIndex + i);
            if (await this.isElementVisible(input, 3000)) {
                await input.click();
                await input.fill(values[i]);
                await input.dispatchEvent('input');
                await input.dispatchEvent('change');
                await input.press('Tab');
                console.log(`  → Filled ${labels[i]}: ${values[i]}`);
            }
        }
        await this.page.waitForTimeout(500);
        console.log('✅ Package dimensions filled');
    }

    /** Select country from the autocomplete dropdown. */
    async selectCountry(countryCode: string): Promise<void> {
        console.log(`Selecting country: ${countryCode}`);
        const countryInput = this.page
            .locator('mat-form-field input[mat-mdc-autocomplete-trigger], mat-form-field input.mat-mdc-autocomplete-trigger')
            .first();

        if (!(await this.isElementVisible(countryInput, 3000))) {
            // Fallback: find by label
            const fallback = this.page.locator('mat-form-field').filter({ hasText: /country/i }).locator('input').first();
            await this.waitForElementToBeVisible(fallback);
            await fallback.fill('');
            await fallback.pressSequentially(countryCode, { delay: 100 });
        } else {
            await countryInput.fill('');
            await countryInput.pressSequentially(countryCode, { delay: 100 });
        }

        await this.page.waitForTimeout(1000);
        const option = this.page.locator('mat-option .mdc-list-item__primary-text').first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await this.page.waitForTimeout(500);
        console.log(`✅ Country selected: ${countryCode}`);
    }

    /** Fill additional weight/insurance fields (number inputs after country). */
    async fillWeightFields(weight: string, insuranceValue?: string): Promise<void> {
        console.log(`Filling weight: ${weight}`);
        const numberInputs = this.page.locator('mat-form-field input[type="number"]');
        const count = await numberInputs.count();

        if (count > 0) {
            const weightInput = numberInputs.first();
            await weightInput.click();
            await weightInput.fill(weight);
            await weightInput.dispatchEvent('input');
            await weightInput.press('Tab');
            console.log(`  → Weight set: ${weight}`);
        }

        if (insuranceValue && count > 1) {
            const insInput = numberInputs.nth(1);
            await insInput.click();
            await insInput.fill(insuranceValue);
            await insInput.dispatchEvent('input');
            await insInput.press('Tab');
            console.log(`  → Insurance value set: ${insuranceValue}`);
        }
    }

    // ─── Actions ────────────────────────────────────────────────────

    /** Click the green save/confirm button (save package or confirm rate). */
    async clickGreenButton(): Promise<void> {
        console.log('Clicking green button...');
        const btn = this.page.locator('button.bg-\\[\\#00a70c\\], button.green-button, button[class*="green"]').first();
        await this.waitForElementToBeVisible(btn);
        await this.click(btn);
        await this.page.waitForTimeout(1000);
        console.log('✅ Green button clicked');
    }

    /** Click the blue "Get Rates" / submit button. */
    async clickGetRates(): Promise<void> {
        console.log('Clicking Get Rates...');
        const btn = this.page.locator('button.blue-button[type="submit"], button[type="submit"].blue-button').first();

        if (await this.isElementVisible(btn, 3000)) {
            await this.click(btn);
        } else {
            // Fallback: look for any blue-styled submit button
            const fallback = this.page.locator('button[type="submit"]').filter({ hasText: /rate|get/i }).first();
            if (await this.isElementVisible(fallback, 3000)) {
                await this.click(fallback);
            } else {
                // Last resort: click any submit button with blue class
                const lastResort = this.page.locator('button[type="submit"]').first();
                await this.click(lastResort);
            }
        }

        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(2000);
        console.log('✅ Get Rates clicked — waiting for results');
    }

    /** Click the red reject/cancel button. */
    async clickRedButton(): Promise<void> {
        console.log('Clicking red button...');
        const btn = this.page.locator('button.red-button[type="submit"], button[class*="red-button"]').first();
        await this.waitForElementToBeVisible(btn);
        await this.click(btn);
        await this.page.waitForTimeout(1000);
        console.log('✅ Red button clicked');
    }

    // ─── Rate selection ─────────────────────────────────────────────

    /** Navigate through rate pages using pagination buttons. */
    async navigateRatePages(direction: 'next' | 'prev' = 'next'): Promise<void> {
        const btnSelector = direction === 'next'
            ? 'button[aria-label="Next page"], button:has-text(">")'
            : 'button[aria-label="Previous page"], button:has-text("<")';
        const btn = this.page.locator(btnSelector).first();

        if (await this.isElementVisible(btn, 3000) && await btn.isEnabled()) {
            await this.click(btn);
            await this.page.waitForTimeout(1000);
            console.log(`  → Navigated to ${direction} rate page`);
        }
    }

    /**
     * Select a rate from the rates table.
     * @param rateIndex 0-based index of the rate to select (default: first)
     */
    async selectRate(rateIndex = 0): Promise<void> {
        console.log(`Selecting rate at index ${rateIndex}...`);

        // Look for clickable rate rows in the results table
        const rateRows = this.page.locator('td.p-2, tr[class*="cursor"]').filter({ hasText: /\$/ });
        const count = await rateRows.count();
        console.log(`  Found ${count} rate rows`);

        if (count > rateIndex) {
            await rateRows.nth(rateIndex).click();
            await this.page.waitForTimeout(1000);
            console.log(`✅ Rate ${rateIndex} selected`);
        } else {
            // Fallback: click the first green price text
            const priceText = this.page.locator('.text-green-600, [class*="text-green"]').first();
            if (await this.isElementVisible(priceText, 3000)) {
                await priceText.click();
                await this.page.waitForTimeout(1000);
                console.log('✅ Rate selected (by price text)');
            }
        }
    }

    /** Click the expand/details icon (mat-icon) on a rate row. */
    async clickRateDetails(): Promise<void> {
        const icon = this.page.locator('mat-icon.notrans, mat-icon').first();
        if (await this.isElementVisible(icon, 3000)) {
            await this.click(icon);
            await this.page.waitForTimeout(500);
            console.log('✅ Rate details expanded');
        }
    }

    /** Confirm the selected rate by clicking the green confirm button. */
    async confirmRate(): Promise<void> {
        console.log('Confirming selected rate...');
        const greenBtn = this.page.locator('button.green-button[type="submit"], button[type="submit"][class*="green"]').first();
        await this.waitForElementToBeVisible(greenBtn);
        await this.click(greenBtn);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log('✅ Rate confirmed');
    }

    // ─── Hazmat ─────────────────────────────────────────────────────

    /** Select a hazmat code from the dropdown. */
    async selectHazmatCode(code: string): Promise<void> {
        console.log(`Selecting Hazmat code: ${code}`);
        const select = this.page.locator('select#hazmatCode');
        await this.waitForElementToBeVisible(select);
        await select.selectOption(code);
        await this.page.waitForTimeout(500);
        console.log(`✅ Hazmat code selected: ${code}`);
    }

    // ─── Mat-Select dropdowns ───────────────────────────────────────

    /** Select an option from a mat-select dropdown by its visible text. */
    async selectMatOption(dropdownLabel: string, optionText: string): Promise<void> {
        console.log(`Selecting "${optionText}" from "${dropdownLabel}" dropdown...`);
        const dropdown = this.page.locator('mat-form-field').filter({ hasText: new RegExp(dropdownLabel, 'i') }).first();

        if (await this.isElementVisible(dropdown, 3000)) {
            await dropdown.click();
            await this.page.waitForTimeout(500);

            const option = this.page.locator('mat-option').filter({ hasText: new RegExp(optionText, 'i') }).first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Selected "${optionText}" from "${dropdownLabel}"`);
        }
    }

    // ─── Data capture ───────────────────────────────────────────────

    /** Read Order details section data. */
    async getOrderDetailsData(): Promise<Record<string, string>> {
        console.log('Capturing Order details...');
        const details: Record<string, string> = {};

        // Try to read labeled form fields
        const labels = ['Order number', 'Shipment number', 'Status'];
        for (const label of labels) {
            const input = this.page.locator('mat-form-field').filter({ hasText: new RegExp(label, 'i') }).locator('input').first();
            if (await this.isElementVisible(input, 2000)) {
                details[label] = await input.inputValue();
            }
        }

        console.log(`📋 Order details: ${JSON.stringify(details)}`);
        return details;
    }

    /** Capture the selected rate information (price, carrier name). */
    async getSelectedRate(): Promise<{ price: string | null; carrier: string | null }> {
        const priceEl = this.page.locator('.text-green-600, [class*="text-green"]').first();
        const price = await this.isElementVisible(priceEl, 2000) ? await priceEl.textContent() : null;

        const carrierEl = this.page.locator('.text-xl.font-bold, [class*="carrier-name"]').first();
        const carrier = await this.isElementVisible(carrierEl, 2000) ? await carrierEl.textContent() : null;

        console.log(`💰 Selected rate: ${price ?? 'N/A'} | Carrier: ${carrier ?? 'N/A'}`);
        return { price: price?.trim() ?? null, carrier: carrier?.trim() ?? null };
    }
}
