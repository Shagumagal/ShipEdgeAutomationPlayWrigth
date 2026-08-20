import { Locator, Page } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Page Object: XenvioCarrierConfigPage
 *
 * Handles the Carrier Configuration flow in the Shipper View.
 *
 * Flow:
 *   1. Click Configuration menu (gear icon button)
 *   2. Click "Configuration" menu item → navigates to /configuration
 *   3. Select a Location (warehouse) from the card list
 *   4. Search for a carrier (e.g. "usps") and select it
 *   5. Fill carrier details: Name, Description, EZ Carrier Account, API Key
 *   6. Click Save
 *   7. Verify: Click "See carriers configured" → find carrier → click "Shipping codes"
 *
 * Follows the project POM pattern: locators declared as readonly,
 * single-responsibility methods, and uses BasePage methods.
 */
export class XenvioCarrierConfigPage extends BasePage {

    // ─── Configuration Menu ──────────────────────────────────────
    readonly configMenuButton: Locator;
    readonly configurationMenuItem: Locator;

    // ─── Carrier Search ──────────────────────────────────────────
    readonly carrierSearchInput: Locator;

    // ─── Carrier Form Fields ─────────────────────────────────────
    readonly nameInput: Locator;
    readonly descriptionInput: Locator;
    readonly ezCarrierAccountInput: Locator;
    readonly apiKeyInput: Locator;
    readonly saveButton: Locator;

    // ─── Post-creation Verification ──────────────────────────────
    readonly seeCarriersConfiguredButton: Locator;
    readonly shippingCodesButton: Locator;

    constructor(page: Page) {
        super(page);

        // Configuration menu – gear/grid icon in the top nav
        this.configMenuButton = page.locator('button').nth(1);
        this.configurationMenuItem = page.getByRole('menuitem', { name: /Configuration/i });

        // Carrier search input in the carrier selection step
        this.carrierSearchInput = page.getByRole('textbox', { name: 'Search' });

        // Carrier detail form
        this.nameInput = page.getByRole('textbox', { name: 'Name' });
        this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
        this.ezCarrierAccountInput = page.getByRole('textbox', { name: 'EZ Carrier Account' });
        this.apiKeyInput = page.getByRole('textbox', { name: 'API Key' });
        this.saveButton = page.getByRole('button', { name: 'Save' });

        // Post-creation
        this.seeCarriersConfiguredButton = page.getByRole('button', { name: 'See carriers configured' });
        this.shippingCodesButton = page.getByRole('button', { name: 'Shipping codes' });
    }

    // ─── Step 1: Open Configuration Menu ─────────────────────────

    /**
     * Click the gear/grid icon button to open the Configuration dropdown menu.
     */
    async clickConfigMenuButton(): Promise<void> {
        console.log('Clicking Configuration menu button...');
        await this.waitForElementToBeVisible(this.configMenuButton);
        await this.click(this.configMenuButton);
        await this.page.waitForTimeout(1000);
        console.log('✅ Configuration menu opened');
    }

    /**
     * Click the "Configuration" menu item from the dropdown.
     */
    async clickConfigurationMenuItem(): Promise<void> {
        console.log('Clicking "Configuration" menu item...');
        await this.waitForElementToBeVisible(this.configurationMenuItem);
        await this.click(this.configurationMenuItem);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Navigated to Configuration page');
    }

    // ─── Step 2: Select Location ─────────────────────────────────

    /**
     * Select a location (warehouse) by clicking the mat-card that contains
     * the warehouse name.
     * @param warehouseName The warehouse name from the environment (e.g. "qa20")
     */
    async selectLocation(warehouseName: string): Promise<void> {
        console.log(`Selecting location: ${warehouseName}...`);
        const locationCard = this.page.locator('mat-card').filter({ hasText: new RegExp(warehouseName, 'i') }).first();
        await this.waitForElementToBeVisible(locationCard);
        await this.click(locationCard);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Location selected: ${warehouseName}`);
    }

    // ─── Step 3: Search and Select Carrier ───────────────────────

    /**
     * Search for a carrier by typing in the Search input.
     * @param carrierSearch The carrier search term (e.g. "usps")
     */
    async searchCarrier(carrierSearch: string): Promise<void> {
        console.log(`Searching for carrier: ${carrierSearch}...`);
        await this.waitForElementToBeVisible(this.carrierSearchInput);
        await this.click(this.carrierSearchInput);
        await this.type(this.carrierSearchInput, carrierSearch);
        await this.page.waitForTimeout(1500);
        console.log(`✅ Carrier search completed: ${carrierSearch}`);
    }

    /**
     * Select a carrier from the search results by clicking the mat-card
     * that contains the carrier name.
     * @param carrierDisplayName The visible carrier name (e.g. "USPS")
     */
    async selectCarrier(carrierDisplayName: string): Promise<void> {
        console.log(`Selecting carrier: ${carrierDisplayName}...`);
        const carrierCard = this.page.locator('mat-card').filter({ hasText: new RegExp(carrierDisplayName, 'i') }).first();
        await this.waitForElementToBeVisible(carrierCard);
        await this.click(carrierCard);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Carrier selected: ${carrierDisplayName}`);
    }

    // ─── Step 4: Fill Carrier Details ────────────────────────────

    /**
     * Fill the carrier Name field.
     * @param name The carrier name (e.g. "Carrier de prueba")
     */
    async fillCarrierName(name: string): Promise<void> {
        console.log(`Filling carrier name: ${name}...`);
        await this.waitForElementToBeVisible(this.nameInput);
        await this.click(this.nameInput);
        await this.type(this.nameInput, name);
        console.log(`  → Carrier name filled: ${name}`);
    }

    /**
     * Fill the carrier Description field.
     * @param description The carrier description (e.g. "test automation")
     */
    async fillCarrierDescription(description: string): Promise<void> {
        console.log(`Filling carrier description: ${description}...`);
        const descriptionLabel = this.page.getByText('Description');
        await this.click(descriptionLabel);
        await this.waitForElementToBeVisible(this.descriptionInput);
        await this.type(this.descriptionInput, description);
        console.log(`  → Carrier description filled: ${description}`);
    }

    /**
     * Fill the EZ Carrier Account field.
     * @param carrierAccount The EZ Carrier Account ID
     */
    async fillEzCarrierAccount(carrierAccount: string): Promise<void> {
        console.log('Filling EZ Carrier Account...');
        await this.waitForElementToBeVisible(this.ezCarrierAccountInput);
        await this.click(this.ezCarrierAccountInput);
        await this.type(this.ezCarrierAccountInput, carrierAccount);
        console.log('  → EZ Carrier Account filled');
    }

    /**
     * Fill the API Key field.
     * @param apiKey The API Key value
     */
    async fillApiKey(apiKey: string): Promise<void> {
        console.log('Filling API Key...');
        await this.waitForElementToBeVisible(this.apiKeyInput);
        await this.click(this.apiKeyInput);
        await this.type(this.apiKeyInput, apiKey);
        console.log('  → API Key filled');
    }

    /**
     * Fill all carrier configuration form fields at once.
     */
    async fillCarrierForm(data: {
        name: string;
        description: string;
        ezCarrierAccount: string;
        apiKey: string;
    }): Promise<void> {
        console.log('Filling carrier configuration form...');
        await this.fillCarrierName(data.name);
        await this.fillCarrierDescription(data.description);
        await this.fillEzCarrierAccount(data.ezCarrierAccount);
        await this.fillApiKey(data.apiKey);
        console.log('✅ Carrier form filled successfully');
    }

    // ─── Step 5: Save Carrier ────────────────────────────────────

    /**
     * Click the Save button to create the carrier.
     */
    async clickSave(): Promise<void> {
        console.log('Clicking Save button...');
        await this.waitForElementToBeVisible(this.saveButton);
        await this.click(this.saveButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(30000);
        await this.page.waitForTimeout(2000);
        console.log('✅ Carrier saved successfully');
    }

    // ─── Step 6: Verify Carrier Created ──────────────────────────

    /**
     * Click "See carriers configured" button to view the list of configured carriers.
     */
    async clickSeeCarriersConfigured(): Promise<void> {
        console.log('Clicking "See carriers configured" button...');
        await this.waitForElementToBeVisible(this.seeCarriersConfiguredButton);
        await this.click(this.seeCarriersConfiguredButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Carriers configured list loaded');
    }

    /**
     * Click on a specific configured carrier by its display text.
     * @param carrierName The name of the carrier to click (e.g. "Carrier de prueba")
     */
    async clickConfiguredCarrier(carrierName: string): Promise<void> {
        console.log(`Clicking on configured carrier: ${carrierName}...`);
        const carrierElement = this.page.getByText(carrierName).first();
        await this.waitForElementToBeVisible(carrierElement);
        await this.click(carrierElement);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Configured carrier clicked: ${carrierName}`);
    }

    /**
     * Click the "Shipping codes" button to view shipping codes for the carrier.
     */
    async clickShippingCodes(): Promise<void> {
        console.log('Clicking "Shipping codes" button...');
        await this.waitForElementToBeVisible(this.shippingCodesButton);
        await this.click(this.shippingCodesButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Shipping codes view loaded');
    }

    /**
     * Navigate back to the carriers configured list by clicking the
     * "Carriers configured" breadcrumb/link.
     */
    async navigateToCarriersConfiguredList(): Promise<void> {
        console.log('Navigating to Carriers configured list...');
        const carriersLink = this.page.getByText('Carriers configured Carriers').first();
        if (await this.isElementVisible(carriersLink, 5000)) {
            await this.click(carriersLink);
            await this.page.waitForLoadState('networkidle');
            await this.waitForXenvioLoading(15000);
            await this.page.waitForTimeout(1000);
            console.log('✅ Navigated back to Carriers configured list');
        } else {
            console.log('⚠ Carriers configured link not found');
        }
    }

    // ─── Visibility Check Methods ────────────────────────────────

    async isCarrierNameInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.nameInput);
    }

    async isSaveButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.saveButton);
    }

    async isSeeCarriersConfiguredButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.seeCarriersConfiguredButton);
    }

    async isShippingCodesButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.shippingCodesButton);
    }

    /**
     * Check if a carrier with the given name is visible in the configured list.
     * @param carrierName The name to search for
     */
    async isCarrierVisibleInList(carrierName: string): Promise<boolean> {
        const carrierElement = this.page.getByText(carrierName).first();
        return await this.isElementVisible(carrierElement, 10000);
    }

    // ─── Static Helpers ──────────────────────────────────────────

    /**
     * Generate a unique carrier name with a timestamp suffix.
     * Example: "USPS Carrier 2026-05-05_16h09"
     */
    static generateCarrierName(carrierType: string): string {
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
        return `${carrierType} Carrier ${timestamp}`;
    }
}
