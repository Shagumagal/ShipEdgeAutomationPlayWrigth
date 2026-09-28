import { Locator, Page } from '@playwright/test';
import BasePage from '../../lib/basepage';
import { XenvioCarrierForm } from './components/xenvio-carrier-form';
import { XenvioConfiguredCarrierList } from './components/xenvio-configured-carrier-list';

/**
 * Page Object: XenvioCarrierConfigPage (v2 — Angular + PrimeNG / mat-card)
 *
 * Handles the Carrier Configuration flow in the Shipper View → Configuration section.
 *
 * Angular source: x5.angular/src/app/wizard/carriers/
 *
 * Flow:
 *   1. Click Configuration gear icon (p-button, pi-cog) → opens p-popover
 *   2. Click "Configuration" from the popover menu
 *   3. Sidebar nav: click "Carriers" step → /configuration/carriers
 *   4. Search and select a carrier (mat-card list with search input)
 *   5. Fill carrier form: Name, Description + dynamic credential fields (formControlName)
 *   6. Click Save
 *   7. Verify: "See carriers configured" → find carrier → "Shipping codes"
 *
 * Delegates to:
 *   - this.form → XenvioCarrierForm (name, description, dynamic credential fields)
 *   - this.list → XenvioConfiguredCarrierList (verify and open a configured carrier)
 *
 * The delegating methods keep their original names, so tests and CarrierService are unaffected.
 */
export class XenvioCarrierConfigPage extends BasePage {

    // ─── Header Nav (Configuration menu) ─────────────────────────
    readonly configMenuButton: Locator;

    // ─── Carrier Search ──────────────────────────────────────────
    readonly carrierSearchInput: Locator;

    // ─── Sub-components ──────────────────────────────────────────
    readonly form: XenvioCarrierForm;
    readonly list: XenvioConfiguredCarrierList;

    // ─── Carrier Form Fields (kept here for existing callers) ────
    readonly nameInput: Locator;
    readonly descriptionInput: Locator;

    // ─── Action Buttons ──────────────────────────────────────────
    readonly saveButton: Locator;
    readonly seeCarriersConfiguredButton: Locator;
    readonly shippingCodesButton: Locator;

    constructor(page: Page) {
        super(page);

        // Header: gear icon → p-button with pi-cog
        // Using pTooltip="Configuration" from the source template
        this.configMenuButton = page.locator('p-button[ptooltip="Configuration"]').first();

        // Carrier search input — plain HTML input with placeholder="Carrier" and id="voice-search"
        this.carrierSearchInput = page.locator('input#voice-search, input[placeholder="Carrier"]').first();

        this.form = new XenvioCarrierForm(page);
        this.list = new XenvioConfiguredCarrierList(page);

        // Same locators as before, now owned by the sub-components
        this.nameInput = this.form.nameInput;
        this.descriptionInput = this.form.descriptionInput;

        // Footer action buttons — wizard-btn style buttons
        this.saveButton = page.locator('button.wizard-btn').filter({ hasText: /Save/i }).first();
        this.seeCarriersConfiguredButton = this.list.seeCarriersConfiguredButton;
        this.shippingCodesButton = page.locator('button.wizard-btn').filter({ hasText: /Shipping codes/i }).first();
    }

    // ─── Step 1: Open Configuration Menu ─────────────────────────

    /**
     * Click the gear icon (p-button pi-cog) to open the Configuration popover menu.
     * Source: header.component.html → p-button[icon="pi pi-cog"]
     */
    async clickConfigMenuButton(): Promise<void> {
        console.log('Clicking Configuration gear icon (p-button pi-cog)...');

        // Try the tooltip-based locator first
        let btn = this.configMenuButton;
        if (!(await this.isElementVisible(btn, 3000))) {
            // Fallback: find by icon class
            btn = this.page.locator('p-button').filter({ has: this.page.locator('.pi-cog') }).first();
        }
        if (!(await this.isElementVisible(btn, 3000))) {
            // Last fallback: use the icon itself
            btn = this.page.locator('.pi-cog').first();
        }

        await this.waitForElementToBeVisible(btn, 10000);
        await this.click(btn);
        await this.page.waitForTimeout(800);
        console.log('✅ Configuration popover opened');
    }

    /**
     * Click the "Configuration" item inside the popover menu.
     * Uses a resilient locator searching for a button with text /Configuration/i.
     */
    async clickConfigurationMenuItem(): Promise<void> {
        console.log('Clicking "Configuration" menu item from popover...');
        const configBtn = this.page.locator('button').filter({ hasText: /Configuration/i }).first();
        await this.waitForElementToBeVisible(configBtn, 10000);
        await this.click(configBtn);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Navigated to Configuration page');
    }



    // ─── Step 2: Navigate to Carriers step ───────────────────────

    /**
     * Click the "Carriers" step in the sidebar navigation.
     * Source: menu-onboarding.component.html → routerLink ['/configuration', step.id]
     * The steps are rendered with step.label translated text.
     */
    async clickCarriersStep(): Promise<void> {
        console.log('Clicking "Carriers" step in sidebar nav...');
        const carriersLink = this.page.locator('a[routerlinkactive]').filter({ hasText: /Carrier/i }).first();

        if (!(await this.isElementVisible(carriersLink, 3000))) {
            // Fallback: look for text in the sidebar nav
            const fallback = this.page.locator('nav a, nav li a').filter({ hasText: /Carrier/i }).first();
            await this.waitForElementToBeVisible(fallback, 10000);
            await this.click(fallback);
        } else {
            await this.click(carriersLink);
        }

        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Navigated to Carriers step');
    }

    // ─── Step 3: Select Location (Warehouse/Facility) ────────────

    /**
     * Select a location (warehouse/facility) by clicking the mat-card that contains
     * the warehouse name.
     * Source: facility.component.html → mat-card with (click)="selectFacility(location)"
     *
     * @param warehouseName The warehouse name from the environment (e.g. "qa20")
     */
    async selectLocation(warehouseName: string): Promise<void> {
        console.log(`Selecting location/facility: ${warehouseName}...`);
        const locationCard = this.page.locator('mat-card').filter({ hasText: new RegExp(warehouseName, 'i') }).first();
        await this.waitForElementToBeVisible(locationCard, 15000);
        await this.click(locationCard);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Location selected: ${warehouseName}`);
    }

    // ─── Step 4: Search and Select Carrier ───────────────────────

    /**
     * Search for a carrier by typing in the Search input.
     * Source: carrier-list.component.html → input#voice-search with (input)="onSearchChange($event)"
     *
     * @param carrierSearch The carrier search term (e.g. "usps")
     */
    async searchCarrier(carrierSearch: string): Promise<void> {
        console.log(`Searching for carrier: ${carrierSearch}...`);
        await this.waitForElementToBeVisible(this.carrierSearchInput, 10000);
        await this.click(this.carrierSearchInput);
        await this.carrierSearchInput.fill(carrierSearch);
        // Signal Angular's (input) event handler
        await this.carrierSearchInput.dispatchEvent('input');
        await this.page.waitForTimeout(1500);
        console.log(`✅ Carrier search completed: ${carrierSearch}`);
    }

    /**
     * Select a carrier from the search results by clicking the mat-card
     * that contains the carrier name.
     * Source: carrier-list.component.html → mat-card with (click)="onCarrierSelected(carrier)"
     *
     * @param carrierDisplayName The visible carrier name (e.g. "USPS")
     */
    async selectCarrier(carrierDisplayName: string): Promise<void> {
        console.log(`Selecting carrier: ${carrierDisplayName}...`);
        const carrierCard = this.page.locator('mat-card').filter({ hasText: new RegExp(carrierDisplayName, 'i') }).first();
        await this.waitForElementToBeVisible(carrierCard, 10000);
        await this.click(carrierCard);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Carrier selected: ${carrierDisplayName}`);
    }

    // ─── Step 6: Save Carrier ────────────────────────────────────

    /**
     * Click the Save button to create the carrier.
     * Source: carrier-configure.component.html → button.wizard-btn-primary (click)="saveCarrier()"
     */
    async clickSave(): Promise<void> {
        console.log('Clicking Save button...');
        await this.waitForElementToBeVisible(this.saveButton, 10000);
        await this.click(this.saveButton);
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Carrier saved successfully');
    }

    // ─── Carrier form (delegates to XenvioCarrierForm) ───────────

    async fillCarrierName(name: string): Promise<void> {
        await this.form.fillCarrierName(name);
    }

    async fillCarrierDescription(description: string): Promise<void> {
        await this.form.fillCarrierDescription(description);
    }

    async fillDynamicField(fieldName: string, value: string): Promise<void> {
        await this.form.fillDynamicField(fieldName, value);
    }

    /** Fill name, description and every dynamic credential field of the carrier. */
    async fillCarrierForm(data: {
        name: string;
        description: string;
        dynamicFields?: { label: string; value: string }[];
    }): Promise<void> {
        await this.form.fillCarrierForm(data);
    }

    // ─── Configured carriers (delegates to XenvioConfiguredCarrierList) ──

    async clickSeeCarriersConfigured(): Promise<void> {
        await this.list.clickSeeCarriersConfigured();
    }

    async clickConfiguredCarrier(carrierName: string): Promise<void> {
        await this.list.clickConfiguredCarrier(carrierName);
    }

    async isCarrierVisibleInList(carrierName: string): Promise<boolean> {
        return this.list.isCarrierVisibleInList(carrierName);
    }

    /**
     * Click the "Shipping codes" button in the footer.
     * Source: carrier-configuration.component.html → button "Shipping codes"
     */
    async clickShippingCodes(): Promise<void> {
        console.log('Clicking "Shipping codes" button...');
        await this.waitForElementToBeVisible(this.shippingCodesButton, 10000);
        await this.click(this.shippingCodesButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Shipping codes view loaded');
    }

    /**
     * Navigate back to the carriers list by clicking "Cancel" or the back button.
     * Source: carrier-configuration.component.html → button "Cancel" (goToCarriersList)
     */
    async navigateBackToCarriersList(): Promise<void> {
        console.log('Navigating back to Carriers list...');
        const cancelBtn = this.page.locator('button.wizard-btn-secondary').filter({ hasText: /Cancel|Back/i }).first();
        if (await this.isElementVisible(cancelBtn, 5000)) {
            await this.click(cancelBtn);
            await this.page.waitForLoadState('networkidle');
            await this.waitForXenvioLoading(15000);
            await this.page.waitForTimeout(1000);
            console.log('✅ Navigated back to Carriers list');
        } else {
            console.log('⚠ Cancel/Back button not found — may already be on carriers list');
        }
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

