import { Page } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Rates Modal
 *
 * Handles all interactions within the "Available Rates" modal
 * that appears after clicking "GET RATES".
 *
 * Follows the project POM pattern: locators declared as readonly
 * in the constructor (see docs/04-page-objects.md).
 */
export class XenvioRatesModal extends BasePage {

    readonly modalContainer;
    readonly paginationSelect;
    readonly tableRows;

    constructor(page: Page) {
        super(page);
        this.modalContainer    = page.locator('mat-dialog-container').first();
        this.paginationSelect  = this.modalContainer.locator('mat-select').first();
        this.tableRows         = this.modalContainer.locator('tbody tr');
    }

    // ─── Waiting ─────────────────────────────────────────────────────

    /**
     * Wait for at least one rate row to appear.
     * Throws if no rates load within the given timeout.
     */
    async waitForRates(timeoutMs = 30000): Promise<void> {
        console.log('Waiting for rates to load in modal...');
        try {
            await this.tableRows.first().waitFor({ state: 'visible', timeout: timeoutMs });
        } catch {
            throw new Error(`No rates appeared in the modal after ${timeoutMs / 1000} seconds.`);
        }
        const rowCount = await this.tableRows.count();
        console.log(`  Found ${rowCount} total rates in modal`);
    }

    // ─── Interactions ─────────────────────────────────────────────────

    /** Change pagination to 50 items per page inside the modal. */
    async changeItemsPerPageTo50(): Promise<void> {
        console.log('Changing items per page to 50...');
        if (await this.isElementVisible(this.paginationSelect, 3000)) {
            await this.click(this.paginationSelect);
            await this.page.waitForTimeout(500);

            const option50 = this.page.locator('mat-option').filter({ hasText: '50' }).first();
            await this.waitForElementToBeVisible(option50);
            await this.click(option50);
            await this.page.waitForTimeout(1000);
            console.log('✅ Items per page set to 50');
        } else {
            console.log('⚠️ Pagination dropdown not found or not needed');
        }
    }

    /**
     * Select a rate by carrier or service name.
     * Falls back to the first available rate if the preferred one is not found.
     */
    async selectRateByText(carrierOrMethod: string): Promise<void> {
        console.log(`Searching for rate matching: "${carrierOrMethod}"...`);
        await this.waitForRates();

        const preferredRow = this.tableRows.filter({ hasText: new RegExp(carrierOrMethod, 'i') }).first();

        if (await this.isElementVisible(preferredRow, 5000)) {
            console.log(`✅ Preferred rate "${carrierOrMethod}" found. Selecting...`);
            await this.click(preferredRow);
        } else {
            console.log(`⚠️ Rate "${carrierOrMethod}" not found. Selecting first as fallback.`);
            const firstRowText = await this.tableRows.first().textContent();
            console.log(`👉 Fallback rate: ${firstRowText?.replace(/\s+/g, ' ').trim()}`);
            await this.click(this.tableRows.first());
        }

        await this.page.waitForTimeout(1000);
    }
}
