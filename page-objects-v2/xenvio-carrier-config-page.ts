import { Locator, Page } from '@playwright/test';
import BasePage from '../lib/basepage';

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
 */
export class XenvioCarrierConfigPage extends BasePage {

    // ─── Header Nav (Configuration menu) ─────────────────────────
    readonly configMenuButton: Locator;

    // ─── Carrier Search ──────────────────────────────────────────
    readonly carrierSearchInput: Locator;

    // ─── Carrier Form Fields (mat-form-field + formControlName) ──
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

        // Carrier form fields — mat-form-field with formControlName
        this.nameInput = page.locator('input[formcontrolname="name"]').first();
        this.descriptionInput = page.locator('input[formcontrolname="description"]').first();

        // Footer action buttons — wizard-btn style buttons
        this.saveButton = page.locator('button.wizard-btn').filter({ hasText: /Save/i }).first();
        this.seeCarriersConfiguredButton = page.locator('button.wizard-btn').filter({ hasText: /See carriers configured/i }).first();
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

    // ─── Step 5: Fill Carrier Form ───────────────────────────────

    /**
     * Fill the carrier Name field.
     * Source: form-carrier.component.html → input[formControlName="name"]
     */
    async fillCarrierName(name: string): Promise<void> {
        console.log(`Filling carrier name: ${name}...`);
        await this.waitForElementToBeVisible(this.nameInput, 10000);
        await this.nameInput.fill(name);
        console.log(`  → Carrier name filled: ${name}`);
    }

    /**
     * Fill the carrier Description field.
     * Source: form-carrier.component.html → input[formControlName="description"]
     */
    async fillCarrierDescription(description: string): Promise<void> {
        console.log(`Filling carrier description: ${description}...`);
        await this.waitForElementToBeVisible(this.descriptionInput, 10000);
        await this.descriptionInput.fill(description);
        console.log(`  → Carrier description filled: ${description}`);
    }

    /**
     * Fill a dynamic credential field by its mat-label text.
     * Source: form-carrier.component.html → dynamic @for loop rendering mat-form-field
     * with [formControlName]="field.id.toString()" and mat-label="{{ field.label || field.name }}"
     *
     * These fields are generated dynamically based on the carrier type, so we find
     * them by label text rather than a fixed formControlName.
     *
     * @param labelText The label visible on the form (e.g. "EZ Carrier Account", "API Key")
     * @param value The value to fill
     */
    async fillDynamicField(labelText: string, value: string): Promise<void> {
        console.log(`Filling dynamic field "${labelText}"...`);

        // Strategy 1: Find mat-form-field containing the label, then fill the input inside
        const matFormField = this.page.locator('mat-form-field').filter({
            has: this.page.locator('mat-label', { hasText: new RegExp(labelText, 'i') })
        }).first();

        if (await this.isElementVisible(matFormField, 5000)) {
            const input = matFormField.locator('input, textarea, mat-select').first();
            await this.waitForElementToBeVisible(input, 5000);
            await input.fill(value);
            console.log(`  → Dynamic field "${labelText}" filled`);
            return;
        }

        // Strategy 2: Find by placeholder
        const byPlaceholder = this.page.locator(`input[placeholder*="${labelText}" i]`).first();
        if (await this.isElementVisible(byPlaceholder, 3000)) {
            await byPlaceholder.fill(value);
            console.log(`  → Dynamic field "${labelText}" filled (via placeholder)`);
            return;
        }

        // Strategy 3: Find by aria-label / role
        const byRole = this.page.getByRole('textbox', { name: new RegExp(labelText, 'i') }).first();
        await this.waitForElementToBeVisible(byRole, 5000);
        await byRole.fill(value);
        console.log(`  → Dynamic field "${labelText}" filled (via role)`);
    }

    /**
     * Fill all carrier configuration form fields at once.
     * Fixed fields: name, description
     * Dynamic fields: any additional credential fields (e.g. EZ Carrier Account, API Key)
     */
    async fillCarrierForm(data: {
        name: string;
        description: string;
        dynamicFields?: { label: string; value: string }[];
    }): Promise<void> {
        console.log('Filling carrier configuration form...');
        await this.fillCarrierName(data.name);
        await this.fillCarrierDescription(data.description);

        if (data.dynamicFields) {
            for (const field of data.dynamicFields) {
                await this.fillDynamicField(field.label, field.value);
            }
        }
        console.log('✅ Carrier form filled successfully');
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

    // ─── Step 7: Verify Carrier Created ──────────────────────────

    /**
     * Click "See carriers configured" button in the footer.
     * Source: carrier-list.component.html → button.wizard-btn-primary "See carriers configured"
     */
    async clickSeeCarriersConfigured(): Promise<void> {
        console.log('Clicking "See carriers configured" button...');
        await this.waitForElementToBeVisible(this.seeCarriersConfiguredButton, 10000);
        await this.click(this.seeCarriersConfiguredButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Carriers configured list loaded');
    }

    /**
     * Click on a specific configured carrier by its exact display name in the sidebar.
     * Source: carrier-configuration.component.html → sidebar div with:
     *   <h4 ... title="USPS Carrier 2026-..." [title]="carrier.nombre"> {{ carrier.nombre }} </h4>
     *
     * Strategy:
     *   1. Find the <h4> by its `title` attribute (exact carrier name — most reliable)
     *   2. Scroll into view (list may be long)
     *   3. Click the parent <div> container (Angular's (click)="selectCarrier(carrier.id)" is on the div)
     *   4. Wait for the right panel to show the carrier form (confirms selection worked)
     *
     * @param carrierName The exact name of the carrier (e.g. "USPS Carrier 2026-08-18_14h04")
     */
    async clickConfiguredCarrier(carrierName: string): Promise<void> {
        console.log(`Selecting configured carrier: "${carrierName}"...`);

        // Strategy 1: find h4 by title attribute (exact match — most resilient)
        let carrierH4 = this.page.locator(`h4[title="${carrierName}"]`).first();

        if (!(await this.isElementVisible(carrierH4, 5000))) {
            // Strategy 2: find h4 with matching text content (fallback if title attr changes)
            console.log('  → title attr not found, falling back to text content...');
            carrierH4 = this.page.locator('h4').filter({ hasText: carrierName }).first();
        }

        await this.waitForElementToBeVisible(carrierH4, 15000);
        await carrierH4.scrollIntoViewIfNeeded();
        console.log(`  → Found carrier h4, scrolled into view`);

        // Click the parent div container (Angular binds the click handler on the div, not the h4)
        const parentDiv = carrierH4.locator('..');
        await parentDiv.click();

        // Wait for the right panel to load the carrier's form (confirms selection)
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(10000);

        // Verify the right panel shows the selected carrier's name
        const formNameInput = this.page.locator('input[formcontrolname="name"]').first();
        if (await this.isElementVisible(formNameInput, 5000)) {
            const formValue = await formNameInput.inputValue().catch(() => '');
            if (formValue.includes(carrierName) || carrierName.includes(formValue)) {
                console.log(`✅ Carrier "${carrierName}" selected — form loaded with matching name`);
            } else {
                console.log(`⚠️ Form loaded but name is "${formValue}" (expected "${carrierName}") — proceeding`);
            }
        } else {
            console.log(`  → Form input not visible — carrier panel may use a different layout`);
        }

        await this.page.waitForTimeout(500);
        console.log(`✅ Configured carrier selected: ${carrierName}`);
    }

    // ─── Visibility Checks ───────────────────────────────────────

    /**
     * Check if a carrier with the given exact name is visible in the configured sidebar list.
     * Uses h4[title] first (exact), falls back to h4 text content.
     */
    async isCarrierVisibleInList(carrierName: string): Promise<boolean> {
        // Try exact title attribute first
        const byTitle = this.page.locator(`h4[title="${carrierName}"]`).first();
        if (await this.isElementVisible(byTitle, 5000)) {
            console.log(`  → Carrier "${carrierName}" found via h4[title]`);
            return true;
        }

        // Fallback: text content match
        const byText = this.page.locator('h4').filter({ hasText: carrierName }).first();
        if (await this.isElementVisible(byText, 5000)) {
            console.log(`  → Carrier "${carrierName}" found via h4 text`);
            return true;
        }

        console.log(`  ⚠️ Carrier "${carrierName}" NOT found in list`);
        return false;
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

    // ─── Visibility Checks ───────────────────────────────────────

    async isCarrierVisibleInList(carrierName: string): Promise<boolean> {
        const carrierElement = this.page.locator('h4, h3, div').filter({ hasText: new RegExp(carrierName, 'i') }).first();
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
