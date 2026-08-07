import { Page, Locator } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Configure Shipment Panel (v2 — PrimeNG)
 *
 * The panel now uses:
 *   - p-accordion (replaces mat-expansion-panel)
 *   - p-select for Ship Code, Carrier, Ship Method, Package Type
 *   - p-selectButton for Address Type (Residential/Commercial)
 *   - p-checkbox for Saturday Delivery and Include Return Label
 *   - p-button for "Set label info", "Clear All", "Revalidate"
 *
 * The "Set return label information" form is a full-page component
 * (set-label-information) with its own form fields — NOT a p-dialog.
 */
export class XenvioConfigureShipmentPanel extends BasePage {

    // ─── Accordion Header ─────────────────────────────────────────
    readonly accordionHeader: Locator;

    constructor(page: Page) {
        super(page);

        // Accordion — the "Configure Shipment" panel
        this.accordionHeader = page.locator('p-accordion-header').filter({ hasText: /Configure Shipment/i }).first();
    }

    // ─── Accordion Control ──────────────────────────────────────

    /** Expand the Configure Shipment accordion panel if collapsed. */
    async expandPanel(): Promise<void> {
        console.log('Expanding Configure Shipment panel...');
        const content = this.page.locator('p-accordion-content').first();

        // Check if already expanded by looking for visible content
        if (await this.isElementVisible(content, 2000)) {
            console.log('✅ Panel already expanded');
            return;
        }

        await this.waitForElementToBeVisible(this.accordionHeader);
        await this.click(this.accordionHeader);
        await this.page.waitForTimeout(500);
        console.log('✅ Configure Shipment panel expanded');
    }

    // ─── Ship Code / Carrier / Ship Method (PrimeNG p-select) ──

    /**
     * Select a Ship Code from the p-select dropdown.
     * Uses inputId="shipCode" or formControlName="shippingMethodConfig".
     */
    async selectShipCode(shipCodeText: string): Promise<void> {
        console.log(`Selecting Ship Code: "${shipCodeText}"...`);
        const shipCodeSelect = this.page.locator('p-select#shipCode, p-select[formcontrolname="shippingMethodConfig"]').first();
        await this.selectPrimeNGDropdown(shipCodeSelect, shipCodeText, 8000, true);
        await this.page.waitForTimeout(500);
        console.log(`✅ Ship Code selected: "${shipCodeText}"`);
    }

    /**
     * Select a Carrier from the p-select dropdown in the Configure Shipment panel.
     * Uses inputId="carrier" or formControlName="carrierAccount".
     */
    async selectCarrier(carrierText: string): Promise<void> {
        console.log(`Selecting Carrier: "${carrierText}"...`);
        const carrierSelect = this.page.locator('p-select#carrier, p-select[formcontrolname="carrierAccount"]').first();
        await this.selectPrimeNGDropdown(carrierSelect, carrierText, 8000);
        await this.page.waitForTimeout(500);
        console.log(`✅ Carrier selected: "${carrierText}"`);
    }

    /**
     * Select a Ship Method from the p-select dropdown.
     * Uses inputId="shipMethod" or formControlName="shippingMethod".
     */
    async selectShipMethod(methodText: string): Promise<void> {
        console.log(`Selecting Ship Method: "${methodText}"...`);
        const methodSelect = this.page.locator('p-select#shipMethod, p-select[formcontrolname="shippingMethod"]').first();
        await this.selectPrimeNGDropdown(methodSelect, methodText, 8000);
        await this.page.waitForTimeout(500);
        console.log(`✅ Ship Method selected: "${methodText}"`);
    }

    /**
     * Select a Package Type from the p-select dropdown.
     */
    async selectPackageType(packageText: string): Promise<void> {
        console.log(`Selecting Package Type: "${packageText}"...`);
        const packageSelect = this.page.locator('p-select#packageType, p-select[formcontrolname="packageType"]').first();
        await this.selectPrimeNGDropdown(packageSelect, packageText, 8000);
        await this.page.waitForTimeout(500);
        console.log(`✅ Package Type selected: "${packageText}"`);
    }

    // ─── Return Label Checkbox ───────────────────────────────────

    /**
     * Enable the "Include return label" checkbox.
     *
     * In the PrimeNG template (configure-shipment.component.html):
     *   <p-checkbox inputId="isAutoReturnLabel" [binary]="true" formControlName="isAutoReturnLabel" />
     *   <label for="isAutoReturnLabel">Include return label</label>
     *
     * The label text is a SIBLING <label>, not inside the <p-checkbox>.
     * We target the <label for="isAutoReturnLabel"> which is always visible and clickable.
     */
    async enableReturnLabel(): Promise<void> {
        console.log('Enabling "Include return label" checkbox...');

        // Target the <label for="isAutoReturnLabel"> which is the visible, clickable element
        const label = this.page.locator('label[for="isAutoReturnLabel"]');
        await this.waitForElementToBeVisible(label);

        // Check if already checked via the hidden input
        const checkbox = this.page.locator('#isAutoReturnLabel');
        const isChecked = await checkbox.isChecked().catch(() => false);

        if (!isChecked) {
            await label.click();
            await this.page.waitForTimeout(500);
            console.log('✅ "Include return label" checked');
        } else {
            console.log('✅ "Include return label" was already checked');
        }
    }

    /**
     * Click "Set label info" button to open the return label form.
     *
     * In the template: <p-button label="Set label info" [text]="true" size="small" />
     * This button only appears when isAutoReturnLabel is true AND !hasReturnLabels().
     *
     * The "Set label info" opens a full-page component (set-label-information),
     * NOT a p-dialog — so we wait for the form's first input to be visible.
     */
    async openSetLabelInfo(): Promise<void> {
        console.log('Opening "Set label info" form...');

        const setLabelBtn = this.page.locator('p-button, button').filter({ hasText: /Set label info/i }).first();
        await this.waitForElementToBeVisible(setLabelBtn);
        await this.click(setLabelBtn);

        // Wait for the set-label-information form to load
        // The first field is input#inventoryLocationName
        const locationInput = this.page.locator('#inventoryLocationName');
        await locationInput.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForTimeout(500);
        console.log('✅ "Set return label information" form opened');
    }

    // ─── Return Label Form (set-label-information component) ─────

    /**
     * Fill the return label form fields.
     *
     * Fields in set-label-information.component.html (all use pInputText + id):
     *   - #inventoryLocationName
     *   - #company
     *   - #phoneNumber
     *   - #email
     *   - #addressControl (Parse address)
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
        const locationInput = this.page.locator('#inventoryLocationName');
        await this.waitForElementToBeVisible(locationInput);
        await locationInput.click();
        await locationInput.fill(data.locationName);
        console.log(`  → Location Name: ${data.locationName}`);

        // Company
        const companyInput = this.page.locator('#company');
        await companyInput.click();
        await companyInput.fill(data.company);
        console.log(`  → Company: ${data.company}`);

        // Phone Number
        const phoneInput = this.page.locator('#phoneNumber');
        await phoneInput.click();
        await phoneInput.fill(data.phone);
        console.log(`  → Phone: ${data.phone}`);

        // Email
        const emailInput = this.page.locator('#email');
        await emailInput.click();
        await emailInput.fill(data.email);
        console.log(`  → Email: ${data.email}`);

        // Parse Address
        const parseAddressInput = this.page.locator('#addressControl');
        await parseAddressInput.click();
        await parseAddressInput.fill(data.parseAddress);
        console.log(`  → Parse Address: ${data.parseAddress}`);

        // Click Parse button (p-button with label="Parse")
        const parseBtn = this.page.locator('p-button').filter({ hasText: /^Parse$/i }).first();
        await this.waitForElementToBeVisible(parseBtn);
        await this.click(parseBtn);
        await this.page.waitForTimeout(2000);
        console.log('✅ Address parsed');
        console.log('✅ Return label form filled');
    }

    /**
     * Select a Carrier in the return label form (set-label-information).
     * Falls back to the first available option if the requested carrier is not found.
     */
    async selectReturnCarrier(carrierText: string): Promise<void> {
        console.log(`Selecting Return Label Carrier: "${carrierText}"...`);
        const carrierSelect = this.page.locator('p-select[formcontrolname="carrier"]').last();
        await this.selectCarrierWithFallback(carrierSelect, carrierText);
    }

    /**
     * Select a Ship Code in the return label form (set-label-information).
     * Falls back to the first available option if the requested ship code is not found.
     */
    async selectReturnShipCode(shipCodeText: string): Promise<void> {
        console.log(`Selecting Return Label Ship Code: "${shipCodeText}"...`);
        const shipCodeSelect = this.page.locator('p-select[formcontrolname="shipCode"]').last();
        await this.selectShipCodeWithFallback(shipCodeSelect, shipCodeText);
    }

    /**
     * Try to select a Carrier from the dropdown with smart fallback.
     * Priority: exact match → any carrier starting with "ez" → first available.
     */
    private async selectCarrierWithFallback(selectLocator: Locator, carrierText: string): Promise<void> {
        try {
            await this.selectPrimeNGDropdown(selectLocator, carrierText, 5000);
            await this.page.waitForTimeout(500);
            console.log(`✅ Return Carrier selected: "${carrierText}"`);
            return;
        } catch {
            console.warn(`⚠️ "${carrierText}" not found in Carrier dropdown — trying smart fallback...`);
        }

        // Close overlay and re-open
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
        await selectLocator.click();
        await this.page.waitForTimeout(400);

        const allOptions = this.page
            .locator('.p-select-overlay li, .p-listbox-option, .p-select-option, [role="option"]');
        const count = await allOptions.count();

        // Priority 1: find a carrier starting with "ez" (EasyPost carriers)
        for (let i = 0; i < count; i++) {
            const text = (await allOptions.nth(i).textContent())?.trim() || '';
            if (/^ez/i.test(text)) {
                await allOptions.nth(i).click();
                await this.page.waitForTimeout(500);
                console.log(`✅ Return Carrier fallback (ez* match): "${text}"`);
                return;
            }
        }

        // Priority 2: first available
        if (count > 0) {
            const text = (await allOptions.first().textContent())?.trim() || '';
            await allOptions.first().click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Return Carrier fallback (first available): "${text}"`);
        } else {
            throw new Error('No carriers available in dropdown');
        }
    }

    /**
     * Try to select a Ship Code from the dropdown with smart fallback.
     * Priority: exact match → "ground" → any non-international code → first available.
     */
    private async selectShipCodeWithFallback(selectLocator: Locator, shipCodeText: string): Promise<void> {
        try {
            await this.selectPrimeNGDropdown(selectLocator, shipCodeText, 5000);
            await this.page.waitForTimeout(500);
            console.log(`✅ Return Ship Code selected: "${shipCodeText}"`);
            return;
        } catch {
            console.warn(`⚠️ "${shipCodeText}" not found in Ship Code dropdown — trying smart fallback...`);
        }

        // Close overlay and re-open
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
        await selectLocator.click();
        await this.page.waitForTimeout(400);

        const allOptions = this.page
            .locator('.p-select-overlay li, .p-listbox-option, .p-select-option, [role="option"]');
        const count = await allOptions.count();

        const INTL_KEYWORDS = /international|intl|global|worldwide/i;

        // Collect all option texts for smart selection
        const options: { index: number; text: string }[] = [];
        for (let i = 0; i < count; i++) {
            const text = (await allOptions.nth(i).textContent())?.trim() || '';
            options.push({ index: i, text });
        }

        // Priority 1: find one with "ground" (non-international)
        const groundOption = options.find(o => /ground/i.test(o.text) && !INTL_KEYWORDS.test(o.text));
        if (groundOption) {
            await allOptions.nth(groundOption.index).click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Return Ship Code fallback (ground): "${groundOption.text}"`);
            return;
        }

        // Priority 2: any non-international option
        const domesticOption = options.find(o => !INTL_KEYWORDS.test(o.text));
        if (domesticOption) {
            await allOptions.nth(domesticOption.index).click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Return Ship Code fallback (domestic): "${domesticOption.text}"`);
            return;
        }

        // Priority 3: first available
        if (count > 0) {
            await allOptions.first().click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Return Ship Code fallback (first available): "${options[0]?.text}"`);
        } else {
            throw new Error('No ship codes available in dropdown');
        }
    }

    // ─── Confirm / Cancel ────────────────────────────────────────

    /**
     * Click Confirm button in the return label form.
     * In the template: <p-button label="Confirm" [disabled]="!hasFormChanges()" />
     */
    async clickConfirm(): Promise<void> {
        console.log('Confirming return label configuration...');
        const confirmBtn = this.page.locator('p-button').filter({ hasText: /^Confirm$/i }).first();
        await this.waitForElementToBeVisible(confirmBtn);
        await this.click(confirmBtn);
        await this.page.waitForTimeout(1000);
        console.log('✅ Return label configuration confirmed');
    }

    async clickCancel(): Promise<void> {
        console.log('Cancelling return label configuration...');
        const cancelBtn = this.page.locator('p-button').filter({ hasText: /^Cancel$/i }).first();
        await this.waitForElementToBeVisible(cancelBtn);
        await this.click(cancelBtn);
        await this.page.waitForTimeout(500);
    }

    // ─── High-Level Convenience Method ───────────────────────────

    /**
     * Full return label configuration flow:
     * 1. Check "Include return label" checkbox
     * 2. Open "Set label info" form
     * 3. Fill form fields (location, company, phone, email, parse address)
     * 4. Select carrier and ship code in the return label form
     * 5. Click Confirm
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
        await this.selectReturnCarrier(data.carrier);
        await this.selectReturnShipCode(data.shipCode);
        await this.clickConfirm();
    }
}
