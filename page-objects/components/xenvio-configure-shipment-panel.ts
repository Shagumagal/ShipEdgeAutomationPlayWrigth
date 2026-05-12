import { Page, Locator } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Configure Shipment Panel
 *
 * Handles all interactions within the "Configure Shipment" sidebar panel,
 * including the "Return Settings" section:
 *   - Check "Include return label"
 *   - Click "Set label info" to open the return label modal
 *   - Fill the return label form (location name, company, phone, email, address)
 *   - Select Carrier and Ship Code from dropdowns
 *   - Confirm the return label configuration
 *
 * This component lives on the Shipper View popup page, alongside
 * XenvioRatesModal, XenvioBoxItemForm, etc.
 *
 * Follows the project POM pattern: locators declared as readonly
 * in the constructor (see docs/04-page-objects.md).
 */
export class XenvioConfigureShipmentPanel extends BasePage {

    // ─── Return Settings ─────────────────────────────────────────
    readonly includeReturnLabelCheckbox: Locator;
    readonly setLabelInfoButton: Locator;

    // ─── Return Label Modal ──────────────────────────────────────
    readonly locationNameInput: Locator;
    readonly companyInput: Locator;
    readonly phoneInput: Locator;
    readonly emailInput: Locator;
    readonly parseAddressInput: Locator;
    readonly parseButton: Locator;
    readonly confirmButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        super(page);

        // Return Settings section
        this.includeReturnLabelCheckbox = page.getByRole('checkbox', { name: 'Include return label' });
        this.setLabelInfoButton = page.getByRole('button', { name: 'Set label info' });

        // Return Label Modal fields
        this.locationNameInput = page.getByRole('textbox', { name: 'Inventory Location Name' });
        this.companyInput = page.getByRole('textbox', { name: 'Company' });
        this.phoneInput = page.getByRole('textbox', { name: 'Phone number' });
        this.emailInput = page.getByRole('textbox', { name: 'Email' });
        this.parseAddressInput = page.getByRole('textbox', { name: 'Parse address' });
        this.parseButton = page.getByRole('button', { name: 'Parse' });
        this.confirmButton = page.getByRole('button', { name: 'Confirm' });
        this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    }

    // ─── Return Label Checkbox ───────────────────────────────────

    /**
     * Check the "Include return label" checkbox if it's not already checked.
     */
    async enableReturnLabel(): Promise<void> {
        console.log('Enabling "Include return label" checkbox...');
        await this.waitForElementToBeVisible(this.includeReturnLabelCheckbox);
        if (!(await this.includeReturnLabelCheckbox.isChecked())) {
            await this.includeReturnLabelCheckbox.check();
            await this.page.waitForTimeout(500);
            console.log('✅ "Include return label" checked');
        } else {
            console.log('✅ "Include return label" was already checked');
        }
    }

    /**
     * Click "Set label info" to open the return label configuration modal.
     */
    async openSetLabelInfo(): Promise<void> {
        console.log('Opening "Set label info" modal...');
        await this.waitForElementToBeVisible(this.setLabelInfoButton);
        await this.click(this.setLabelInfoButton);
        // Wait for the modal form fields to appear
        await this.waitForElementToBeVisible(this.locationNameInput, 10000);
        await this.page.waitForTimeout(500);
        console.log('✅ "Set label info" modal opened');
    }

    // ─── Return Label Form ───────────────────────────────────────

    /**
     * Fill all fields in the return label modal form.
     */
    async fillReturnLabelForm(data: {
        locationName: string;
        company: string;
        phone: string;
        email: string;
        parseAddress: string;
    }): Promise<void> {
        console.log('Filling return label form...');

        // Inventory Location Name
        await this.waitForElementToBeVisible(this.locationNameInput);
        await this.type(this.locationNameInput, data.locationName);
        console.log(`  → Location Name: ${data.locationName}`);

        // Company
        await this.type(this.companyInput, data.company);
        console.log(`  → Company: ${data.company}`);

        // Phone number
        await this.type(this.phoneInput, data.phone);
        console.log(`  → Phone: ${data.phone}`);

        // Email
        await this.type(this.emailInput, data.email);
        console.log(`  → Email: ${data.email}`);

        // Parse address — fill the full address string and click Parse
        await this.type(this.parseAddressInput, data.parseAddress);
        console.log(`  → Parse Address: ${data.parseAddress}`);

        await this.waitForElementToBeVisible(this.parseButton);
        await this.click(this.parseButton);
        // Wait for the parse to complete and populate individual fields
        await this.page.waitForTimeout(2000);
        console.log('✅ Address parsed');

        console.log('✅ Return label form filled');
    }

    // ─── Carrier & Ship Code Dropdowns ───────────────────────────

    /**
     * Select a carrier from the Carrier dropdown in the return label modal.
     * Uses partial text matching to handle dynamic carrier names (e.g. 'usps_qa20-').
     * @param carrierText Partial or full text of the carrier option
     */
    async selectCarrier(carrierText: string): Promise<void> {
        console.log(`Selecting carrier: "${carrierText}"...`);
        const carrierDropdown = this.page
            .locator('mat-form-field')
            .filter({ hasText: /Carrier/i })
            .locator('mat-select')
            .first();

        if (await this.isElementVisible(carrierDropdown, 5000)) {
            await carrierDropdown.click();
            await this.page.waitForTimeout(500);
            const option = this.page.locator('mat-option').filter({ hasText: new RegExp(carrierText, 'i') }).first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Carrier selected: "${carrierText}"`);
        } else {
            console.log('⚠️ Carrier dropdown not found, trying fallback...');
            // Fallback: click any mat-select that contains carrier-like options
            const fallbackSelect = this.page.locator('mat-select').first();
            await fallbackSelect.click();
            await this.page.waitForTimeout(500);
            const fallbackOption = this.page.locator('mat-option').filter({ hasText: new RegExp(carrierText, 'i') }).first();
            if (await this.isElementVisible(fallbackOption, 3000)) {
                await fallbackOption.click();
                console.log(`✅ Carrier selected via fallback: "${carrierText}"`);
            } else {
                // Select first available option as last resort
                const firstOption = this.page.locator('mat-option').first();
                await firstOption.click();
                const optionText = await firstOption.textContent();
                console.log(`⚠️ Carrier "${carrierText}" not found. Selected first available: "${optionText?.trim()}"`);
            }
        }
    }

    /**
     * Select a ship code from the Ship Code dropdown in the return label modal.
     * Uses partial text matching for flexibility.
     * @param shipCodeText Partial or full text of the ship code option
     */
    async selectShipCode(shipCodeText: string): Promise<void> {
        console.log(`Selecting ship code: "${shipCodeText}"...`);
        const shipCodeDropdown = this.page
            .locator('mat-form-field')
            .filter({ hasText: /Ship Code|Ship Method/i })
            .locator('mat-select')
            .first();

        if (await this.isElementVisible(shipCodeDropdown, 5000)) {
            await shipCodeDropdown.click();
            await this.page.waitForTimeout(500);
            const option = this.page.locator('mat-option').filter({ hasText: new RegExp(shipCodeText, 'i') }).first();
            if (await this.isElementVisible(option, 5000)) {
                await option.click();
                await this.page.waitForTimeout(500);
                console.log(`✅ Ship code selected: "${shipCodeText}"`);
            } else {
                // Fallback: select first available ship code
                const firstOption = this.page.locator('mat-option').first();
                await firstOption.click();
                const optionText = await firstOption.textContent();
                console.log(`⚠️ Ship code "${shipCodeText}" not found. Selected first available: "${optionText?.trim()}"`);
            }
        } else {
            console.log('⚠️ Ship Code dropdown not found');
        }
    }

    // ─── Confirm / Cancel ────────────────────────────────────────

    /**
     * Click "Confirm" to save the return label configuration.
     */
    async clickConfirm(): Promise<void> {
        console.log('Confirming return label configuration...');
        await this.waitForElementToBeVisible(this.confirmButton);
        await this.click(this.confirmButton);
        await this.page.waitForTimeout(1000);
        console.log('✅ Return label configuration confirmed');
    }

    /**
     * Click "Cancel" to discard the return label configuration.
     */
    async clickCancel(): Promise<void> {
        console.log('Cancelling return label configuration...');
        await this.waitForElementToBeVisible(this.cancelButton);
        await this.click(this.cancelButton);
        await this.page.waitForTimeout(500);
        console.log('✅ Return label configuration cancelled');
    }

    // ─── High-Level Convenience Method ───────────────────────────

    /**
     * Full flow: Enable return label, open the modal, fill the form,
     * select carrier + ship code, and confirm.
     *
     * @param data Return label form data + carrier and ship code selections
     */
    async configureReturnLabel(data: {
        locationName: string;
        company: string;
        phone: string;
        email: string;
        parseAddress: string;
        carrier: string;
        shipCode: string;
    }): Promise<void> {
        await this.enableReturnLabel();
        await this.openSetLabelInfo();
        await this.fillReturnLabelForm(data);
        await this.selectCarrier(data.carrier);
        await this.selectShipCode(data.shipCode);
        await this.clickConfirm();
    }
}
