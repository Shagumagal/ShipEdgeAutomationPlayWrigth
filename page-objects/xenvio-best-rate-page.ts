import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";
import logger from "../lib/logger";

// Initialize logger for this module
const log = logger({ filename: __filename });

/**
 * Page Object: XenvioBestRatePage
 *
 * Handles the Best Rate configuration flow in Shipper View → Configuration.
 *
 * Flow:
 *   1. Click Configuration menu (gear icon button)
 *   2. Click "Configuration" menu item → navigates to /configuration
 *   3. Select a Location (warehouse) from the card list
 *   4. Click "Continue" → enters the Best Rate section
 *   5. Click "New Best Rate"
 *   6. Fill in Name, Description, Transit Days, Minimum Price
 *   7. Click "Save & Continue"
 *   8. Verify the success toast message
 *   9. Assign shipping codes by clicking the arrow (→) buttons per code
 *  10. Click "Done" to confirm the shipping code step
 *  11. Select the created Best Rate card → Click "Done"
 *  12. Confirm the Best Rate selection → Click "Done" (final)
 *
 * Follows the project POM pattern: locators declared as readonly,
 * single-responsibility methods, logger used for debug/info, and uses BasePage methods.
 */
export class XenvioBestRatePage extends BasePage {

    // ─── Configuration Menu ───────────────────────────────────────
    readonly configMenuButton: Locator;
    readonly configurationMenuItem: Locator;

    // ─── Location / Warehouse Selection ───────────────────────────
    // (location card is dynamic – resolved in method)

    // ─── Continue Button (after warehouse selection) ───────────────
    readonly continueButton: Locator;

    // ─── Best Rate List Page ───────────────────────────────────────
    readonly newBestRateButton: Locator;

    // ─── Best Rate Form ───────────────────────────────────────────
    readonly nameInput: Locator;
    readonly descriptionInput: Locator;
    readonly transitDaysInput: Locator;
    readonly minimumPriceInput: Locator;
    readonly saveAndContinueButton: Locator;

    // ─── Success Toast ────────────────────────────────────────────
    readonly successToast: Locator;

    // ─── Shipping Codes Table ─────────────────────────────────────
    // The table lists available shipping codes. Rows are dynamic – resolved in methods.

    // ─── Done Buttons (multiple usage throughout the flow) ────────
    readonly doneButton: Locator;

    constructor(page: Page) {
        super(page);

        // Configuration menu – gear/settings icon in the top nav
        this.configMenuButton = page.locator('button').nth(1);
        this.configurationMenuItem = page.getByRole('menuitem', { name: /Configuration/i });

        // Continue button shown after selecting the warehouse
        this.continueButton = page.getByRole('button', { name: 'Continue' });

        // New Best Rate CTA
        this.newBestRateButton = page.getByRole('button', { name: 'New Best Rate' });

        // Best Rate creation form fields
        this.nameInput = page.getByRole('textbox', { name: 'Name' });
        this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
        
        // Resilient selectors using formcontrolname or placeholders to handle type="text" vs type="number" across environments
        this.transitDaysInput = page.locator('input[formcontrolname="transit_days"], input[placeholder*="transit days" i]');
        this.minimumPriceInput = page.locator('input[formcontrolname="minimum_price"], input[placeholder*="minimum price" i]');
        
        this.saveAndContinueButton = page.getByRole('button', { name: 'Save & Continue' });

        // Success toast: matches any toast message containing SUCCESS (case-insensitive) shown after saving
        this.successToast = page.locator('div').filter({ hasText: /SUCCESS/i }).first();

        // The primary Done button used across multiple steps
        this.doneButton = page.getByRole('button', { name: 'Done' });
    }

    // ─── Step 1: Open Configuration Menu ─────────────────────────

    /**
     * Click the gear/grid icon button to open the Configuration dropdown menu.
     */
    async clickConfigMenuButton(): Promise<void> {
        log.info('Clicking Configuration menu button...');
        await this.waitForElementToBeVisible(this.configMenuButton);
        await this.click(this.configMenuButton);
        await this.page.waitForTimeout(1000);
        log.info('✅ Configuration menu opened');
    }

    /**
     * Click the "Configuration" menu item from the dropdown.
     */
    async clickConfigurationMenuItem(): Promise<void> {
        log.info('Clicking "Configuration" menu item...');
        await this.waitForElementToBeVisible(this.configurationMenuItem);
        await this.click(this.configurationMenuItem);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        log.info('✅ Navigated to Configuration page');
    }

    // ─── Step 2: Select Location / Warehouse ─────────────────────

    /**
     * Select a location (warehouse) by clicking the mat-card that contains
     * the warehouse name.
     * @param warehouseName The warehouse name from the environment (e.g. "qa20")
     */
    async selectLocation(warehouseName: string): Promise<void> {
        log.info(`Selecting location: ${warehouseName}...`);
        const locationCard = this.page
            .locator('mat-card')
            .filter({ hasText: new RegExp(warehouseName, 'i') })
            .first();
        await this.waitForElementToBeVisible(locationCard);
        await this.click(locationCard);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        log.info(`✅ Location selected: ${warehouseName}`);
    }

    // ─── Step 3: Click Continue ───────────────────────────────────

    /**
     * Click "Continue" after selecting the warehouse.
     * This is the transition point from the shared Carrier Config flow into the Best Rate flow.
     */
    async clickContinue(): Promise<void> {
        log.info('Clicking "Continue" button...');
        await this.waitForElementToBeVisible(this.continueButton);
        await this.click(this.continueButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        log.info('✅ Passed warehouse selection, Best Rate view loaded');
    }

    // ─── Step 4: Open New Best Rate Form ─────────────────────────

    /**
     * Click the "New Best Rate" button to open the creation form.
     */
    async clickNewBestRate(): Promise<void> {
        log.info('Clicking "New Best Rate" button...');
        await this.waitForElementToBeVisible(this.newBestRateButton);
        await this.click(this.newBestRateButton);
        await this.page.waitForTimeout(1000);
        log.info('✅ New Best Rate form opened');
    }

    // ─── Step 5: Fill Best Rate Form ─────────────────────────────

    /**
     * Fill the Name field of the Best Rate form.
     * @param name The best rate name
     */
    async fillName(name: string): Promise<void> {
        log.info(`Filling Best Rate name: "${name}"...`);
        await this.waitForElementToBeVisible(this.nameInput);
        await this.click(this.nameInput);
        await this.type(this.nameInput, name);
        log.debug(`  → Name filled: "${name}"`);
    }

    /**
     * Fill the Description field.
     * @param description The best rate description
     */
    async fillDescription(description: string): Promise<void> {
        log.info(`Filling description: "${description}"...`);
        await this.waitForElementToBeVisible(this.descriptionInput);
        await this.click(this.descriptionInput);
        await this.type(this.descriptionInput, description);
        log.debug(`  → Description filled`);
    }

    /**
     * Fill the Transit Days spinbutton.
     * @param days The number of transit days (e.g. "1")
     */
    async fillTransitDays(days: string): Promise<void> {
        log.info(`Filling Transit Days: ${days}...`);
        await this.waitForElementToBeVisible(this.transitDaysInput);
        await this.click(this.transitDaysInput);
        await this.type(this.transitDaysInput, days);
        log.debug(`  → Transit Days filled: ${days}`);
    }

    /**
     * Fill the Minimum Price spinbutton.
     * @param price The minimum price (e.g. "1")
     */
    async fillMinimumPrice(price: string): Promise<void> {
        log.info(`Filling Minimum Price: ${price}...`);
        await this.waitForElementToBeVisible(this.minimumPriceInput);
        await this.click(this.minimumPriceInput);
        await this.type(this.minimumPriceInput, price);
        log.debug(`  → Minimum Price filled: ${price}`);
    }

    /**
     * Fill all Best Rate form fields at once.
     * @param data Form data object
     */
    async fillBestRateForm(data: {
        name: string;
        description: string;
        transitDays: string;
        minimumPrice: string;
    }): Promise<void> {
        log.info('Filling Best Rate form...');
        await this.fillName(data.name);
        await this.fillDescription(data.description);
        await this.fillTransitDays(data.transitDays);
        await this.fillMinimumPrice(data.minimumPrice);
        log.info('✅ Best Rate form filled successfully');
    }

    // ─── Step 6: Save & Continue ──────────────────────────────────

    /**
     * Click "Save & Continue" to save the Best Rate configuration.
     */
    async clickSaveAndContinue(): Promise<void> {
        log.info('Clicking "Save & Continue"...');
        await this.waitForElementToBeVisible(this.saveAndContinueButton);
        await this.click(this.saveAndContinueButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(30000);
        await this.page.waitForTimeout(2000);
        log.info('✅ Best Rate saved');
    }

    // ─── Step 7: Verify Success Toast ────────────────────────────

    /**
     * Waits for the SUCCESS toast and asserts it is visible.
     * Returns true if the toast appeared, false otherwise.
     */
    async verifySuccessToast(): Promise<boolean> {
        log.info('Verifying SUCCESS toast message...');
        const isVisible = await this.isElementVisible(this.successToast, 10000);
        if (isVisible) {
            log.info('✅ SUCCESS toast confirmed');
        } else {
            log.warn('⚠ SUCCESS toast NOT found within timeout');
        }
        return isVisible;
    }

    // ─── Step 8: Assign Shipping Codes ───────────────────────────

    /**
     * Assign a shipping code by clicking the "Select {shippingCode}" button,
     * which represents the arrow (→) that moves a code into the Best Rate.
     *
     * Shipping codes are presented in a table. The recorded locator in the
     * code generation was `getByRole('button', { name: 'Select {code}' })`.
     *
     * @param shippingCode The shipping code label (e.g. "Flat Rate Box - Medium", "Express")
     * @param occurrence   Which occurrence to click (0-based index, default 0 = first visible)
     */
    async assignShippingCode(shippingCode: string, occurrence = 0): Promise<void> {
        log.info(`Assigning shipping code: "${shippingCode}" (occurrence: ${occurrence})...`);
        const button = this.page.getByRole('button', { name: `Select ${shippingCode}` }).nth(occurrence);
        await this.waitForElementToBeVisible(button);
        await this.click(button);
        await this.page.waitForTimeout(500);
        log.info(`✅ Shipping code assigned: "${shippingCode}"`);
    }

    /**
     * Verify that a shipping code cell/row is visible in the assigned (right-hand) panel.
     * After assigning a code with the arrow button it should appear in the selected list.
     *
     * @param code The shipping code text to locate (e.g. "EUSFRBD", "EUSEM", "EUSALP")
     */
    async isShippingCodeAssigned(code: string): Promise<boolean> {
        log.info(`Verifying shipping code is assigned: "${code}"...`);
        // The assigned list uses table cells (td) with the code text
        const cell = this.page.getByRole('cell', { name: code }).first();
        const visible = await this.isElementVisible(cell, 8000);
        log.info(visible
            ? `✅ Shipping code "${code}" found in assigned list`
            : `⚠ Shipping code "${code}" NOT found in assigned list`
        );
        return visible;
    }

    /**
     * Get the count of shipping code rows currently in the assigned list.
     * Useful to assert before/after counts when validating assignments.
     *
     * @param containerFilter A hasText filter to narrow the table (optional)
     */
    async getAssignedShippingCodesCount(containerFilter?: string): Promise<number> {
        const rows = containerFilter
            ? this.page.locator('tr').filter({ hasText: containerFilter })
            : this.page.locator('tbody tr');
        const count = await rows.count();
        log.debug(`Assigned shipping codes count: ${count}`);
        return count;
    }

    // ─── Step 9: Click Done (Shipping Codes step) ─────────────────

    /**
     * Click the "Done" button.
     * Used in multiple steps of the Best Rate flow:
     *   - After assigning shipping codes
     *   - After selecting the Best Rate card
     *   - At the final confirmation step
     */
    async clickDone(): Promise<void> {
        log.info('Clicking "Done" button...');
        await this.waitForElementToBeVisible(this.doneButton);
        await this.click(this.doneButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        log.info('✅ "Done" clicked');
    }

    // ─── Step 10: Select Best Rate Card ───────────────────────────

    /**
     * Click the Best Rate mat-card that matches the given name
     * (shown in the "Choose Best Rate" step).
     *
     * @param bestRateName The name used when creating the Best Rate
     */
    async selectBestRateCard(bestRateName: string): Promise<void> {
        log.info(`Selecting Best Rate card: "${bestRateName}"...`);
        const card = this.page
            .locator('mat-card')
            .filter({ hasText: new RegExp(bestRateName, 'i') })
            .first();
        await this.waitForElementToBeVisible(card);
        await this.click(card);
        await this.page.waitForTimeout(1000);
        log.info(`✅ Best Rate card selected: "${bestRateName}"`);
    }

    // ─── Visibility Checks ────────────────────────────────────────

    async isNewBestRateButtonVisible(): Promise<boolean> {
        return this.isElementVisible(this.newBestRateButton);
    }

    async isSaveAndContinueButtonVisible(): Promise<boolean> {
        return this.isElementVisible(this.saveAndContinueButton);
    }

    async isDoneButtonVisible(): Promise<boolean> {
        return this.isElementVisible(this.doneButton);
    }

    async isBestRateCardVisible(bestRateName: string): Promise<boolean> {
        const card = this.page
            .locator('mat-card')
            .filter({ hasText: new RegExp(bestRateName, 'i') })
            .first();
        return this.isElementVisible(card, 10000);
    }

    // ─── Static Helpers ───────────────────────────────────────────

    /**
     * Generate a unique Best Rate name with a timestamp suffix and worker index.
     * Example: "Best Rate QA 2026-05-28_16h45m32s_W0"
     */
    static generateBestRateName(prefix = 'Best Rate QA', workerIndex?: number): string {
        const now = new Date();
        const timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-') + '_' + 
        String(now.getHours()).padStart(2, '0') + 'h' + 
        String(now.getMinutes()).padStart(2, '0') + 'm' + 
        String(now.getSeconds()).padStart(2, '0') + 's';
        
        const suffix = workerIndex !== undefined ? `_W${workerIndex}` : '';
        return `${prefix} ${timestamp}${suffix}`;
    }
}
