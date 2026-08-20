import { Page } from "@playwright/test";
import BasePage from "../../../lib/basepage";

/**
 * Component: Rates Modal (v2 — Angular Material Dialog)
 *
 * The new rates modal (available-rates.component.html) uses:
 *   - mat-dialog-content as the container
 *   - div cards with class "cursor-pointer" as clickable rate rows (NOT tbody tr)
 *   - A spinner div while loading (class="spinner-container")
 *   - No pagination (no 50-items-per-page selector needed)
 *
 * Each rate card renders: carrier logo + name, shippingMethodName, $price, delivery date.
 * Cards are direct children of the space-y-2 div inside mat-dialog-content.
 */
export class XenvioRatesModal extends BasePage {

    // The mat-dialog-content container
    readonly dialogContent;

    // Clickable rate cards — div.cursor-pointer inside mat-dialog-content
    readonly rateCards;

    // Loading spinner
    readonly loadingSpinner;

    constructor(page: Page) {
        super(page);

        this.dialogContent  = page.locator('mat-dialog-content');
        this.rateCards      = page.locator('mat-dialog-content div.cursor-pointer');
        this.loadingSpinner = page.locator('mat-dialog-content .spinner-container');
    }

    // ─── Waiting ──────────────────────────────────────────────────────

    /**
     * Wait for the rates modal to open AND the spinner to disappear,
     * then verify at least one rate card is visible.
     */
    async waitForRates(timeoutMs = 60000): Promise<void> {
        console.log('Waiting for rates modal to appear...');

        // 1. Wait for mat-dialog-content to be visible
        await this.dialogContent.waitFor({ state: 'visible', timeout: timeoutMs });
        console.log('  ✅ Rates modal opened');

        // 2. Wait for the spinner to disappear (rates are loading)
        console.log('  ⏳ Waiting for spinner to disappear...');
        try {
            await this.loadingSpinner.waitFor({ state: 'hidden', timeout: timeoutMs });
        } catch {
            console.log('  ℹ️ Spinner not found or already gone');
        }

        // 3. Wait for at least one rate card to appear
        const firstCard = this.rateCards.first();
        try {
            await firstCard.waitFor({ state: 'visible', timeout: 30000 });
        } catch {
            throw new Error(`No rate cards appeared in the modal after ${timeoutMs / 1000}s. The shipment may have no available carriers.`);
        }

        const count = await this.rateCards.count();
        console.log(`  ✅ ${count} rate card(s) loaded`);
    }

    // ─── Interactions ─────────────────────────────────────────────────

    /**
     * Select the FIRST available rate card.
     * This is the simplest and most reliable strategy.
     */
    async selectFirstRate(timeoutMs = 60000): Promise<string> {
        await this.waitForRates(timeoutMs);

        const firstCard = this.rateCards.first();
        const cardText  = await firstCard.textContent() ?? '';
        const label     = cardText.replace(/\s+/g, ' ').trim().substring(0, 80);

        console.log(`👉 Selecting first rate: ${label}...`);
        await this.click(firstCard);
        await this.page.waitForTimeout(500);
        console.log('✅ First rate selected');
        return label;
    }

    /**
     * Select a rate by carrier or service name text (with first-rate fallback).
     * Only use this when you need a specific carrier; otherwise prefer selectFirstRate().
     */
    async selectRateByText(carrierOrMethod: string, timeoutMs = 60000): Promise<void> {
        console.log(`Searching for rate matching: "${carrierOrMethod}"...`);
        await this.waitForRates(timeoutMs);

        const preferredCard = this.rateCards.filter({ hasText: new RegExp(carrierOrMethod, 'i') }).first();

        if (await this.isElementVisible(preferredCard, 5000)) {
            const cardText = await preferredCard.textContent() ?? '';
            console.log(`✅ Preferred rate "${carrierOrMethod}" found. Selecting...`);
            await this.click(preferredCard);
        } else {
            console.log(`⚠️ Rate "${carrierOrMethod}" not found. Falling back to first rate.`);
            await this.selectFirstRate(timeoutMs);
            return;
        }

        await this.page.waitForTimeout(500);
    }
}
