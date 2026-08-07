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
 */
export class XenvioConfigureShipmentPanel extends BasePage {

    // ─── Accordion Header ─────────────────────────────────────────
    readonly accordionHeader: Locator;

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

        // Accordion — the "Configure Shipment" panel
        this.accordionHeader = page.locator('p-accordion-header').filter({ hasText: /Configure Shipment/i }).first();

        // Return Settings — p-checkbox with label "Include return label"
        this.includeReturnLabelCheckbox = page.locator('p-checkbox#isAutoReturnLabel, p-checkbox').filter({ hasText: /return label/i }).first();
        this.setLabelInfoButton = page.locator('p-button, button').filter({ hasText: /Set label info/i }).first();

        // Return Label Modal fields (same as legacy — these are in a mat-dialog or p-dialog)
        this.locationNameInput = page.getByRole('textbox', { name: 'Inventory Location Name' });
        this.companyInput = page.getByRole('textbox', { name: 'Company' });
        this.phoneInput = page.getByRole('textbox', { name: 'Phone number' });
        this.emailInput = page.getByRole('textbox', { name: 'Email' });
        this.parseAddressInput = page.getByRole('textbox', { name: 'Parse address' });
        this.parseButton = page.getByRole('button', { name: 'Parse' });
        this.confirmButton = page.getByRole('button', { name: 'Confirm' });
        this.cancelButton = page.getByRole('button', { name: 'Cancel' });
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
     * Select a Carrier from the p-select dropdown.
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

    async enableReturnLabel(): Promise<void> {
        console.log('Enabling "Include return label" checkbox...');
        await this.waitForElementToBeVisible(this.includeReturnLabelCheckbox);
        // PrimeNG checkbox — click the label or the component itself
        const checkbox = this.includeReturnLabelCheckbox.locator('input[type="checkbox"]').first();
        if (!(await checkbox.isChecked())) {
            await this.includeReturnLabelCheckbox.click();
            await this.page.waitForTimeout(500);
            console.log('✅ "Include return label" checked');
        } else {
            console.log('✅ "Include return label" was already checked');
        }
    }

    async openSetLabelInfo(): Promise<void> {
        console.log('Opening "Set label info" modal...');
        await this.waitForElementToBeVisible(this.setLabelInfoButton);
        await this.click(this.setLabelInfoButton);
        await this.waitForElementToBeVisible(this.locationNameInput, 10000);
        await this.page.waitForTimeout(500);
        console.log('✅ "Set label info" modal opened');
    }

    // ─── Return Label Form ───────────────────────────────────────

    async fillReturnLabelForm(data: {
        locationName: string;
        company: string;
        phone: string;
        email: string;
        parseAddress: string;
    }): Promise<void> {
        console.log('Filling return label form...');

        await this.waitForElementToBeVisible(this.locationNameInput);
        await this.type(this.locationNameInput, data.locationName);
        console.log(`  → Location Name: ${data.locationName}`);

        await this.type(this.companyInput, data.company);
        console.log(`  → Company: ${data.company}`);

        await this.type(this.phoneInput, data.phone);
        console.log(`  → Phone: ${data.phone}`);

        await this.type(this.emailInput, data.email);
        console.log(`  → Email: ${data.email}`);

        await this.type(this.parseAddressInput, data.parseAddress);
        console.log(`  → Parse Address: ${data.parseAddress}`);

        await this.waitForElementToBeVisible(this.parseButton);
        await this.click(this.parseButton);
        await this.page.waitForTimeout(2000);
        console.log('✅ Address parsed');
        console.log('✅ Return label form filled');
    }

    // ─── Confirm / Cancel ────────────────────────────────────────

    async clickConfirm(): Promise<void> {
        console.log('Confirming return label configuration...');
        await this.waitForElementToBeVisible(this.confirmButton);
        await this.click(this.confirmButton);
        await this.page.waitForTimeout(1000);
        console.log('✅ Return label configuration confirmed');
    }

    async clickCancel(): Promise<void> {
        console.log('Cancelling return label configuration...');
        await this.waitForElementToBeVisible(this.cancelButton);
        await this.click(this.cancelButton);
        await this.page.waitForTimeout(500);
    }

    // ─── High-Level Convenience Method ───────────────────────────

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
