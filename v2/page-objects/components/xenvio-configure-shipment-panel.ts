import { Page, Locator } from "@playwright/test";
import BasePage from "../base-page";
import { XenvioReturnLabelForm } from "./xenvio-return-label-form";

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
 * The four p-select dropdowns are exposed as locators so the carrier matrix
 * (v2/carrier-matrix/) can list their options and read what they show.
 *
 * The "Set return label information" form is a full-page component
 * (set-label-information) with its own form fields — NOT a p-dialog — and lives in
 * XenvioReturnLabelForm. The return-label methods below delegate to it and keep their
 * original names, so tests and services are unaffected.
 */
export class XenvioConfigureShipmentPanel extends BasePage {

    // ─── Accordion Header ─────────────────────────────────────────
    readonly accordionHeader: Locator;
    /** "Set label info" form (set-label-information component). */
    readonly returnLabelForm: XenvioReturnLabelForm;

    // ─── Dropdowns (p-select) ─────────────────────────────────────
    readonly shipCodeSelect: Locator;
    readonly carrierSelect: Locator;
    readonly shipMethodSelect: Locator;
    readonly packageTypeSelect: Locator;

    constructor(page: Page) {
        super(page);

        this.returnLabelForm = new XenvioReturnLabelForm(page);

        // Accordion — the "Configure Shipment" panel
        this.accordionHeader = page.locator('p-accordion-header').filter({ hasText: /Configure Shipment/i }).first();

        this.shipCodeSelect = page.locator('p-select#shipCode, p-select[formcontrolname="shippingMethodConfig"]').first();
        this.carrierSelect = page.locator('p-select#carrier, p-select[formcontrolname="carrierAccount"]').first();
        this.shipMethodSelect = page.locator('p-select#shipMethod, p-select[formcontrolname="shippingMethod"]').first();
        this.packageTypeSelect = page.locator('p-select#packageType, p-select[formcontrolname="packageType"]').first();
    }

    // ─── Accordion Control ──────────────────────────────────────

    /** Expand the Configure Shipment accordion panel if collapsed. */
    async expandPanel(): Promise<void> {
        console.log('Expanding Configure Shipment panel...');

        // Expanded when its own Ship Code dropdown is visible (the first p-accordion-content
        // of the page can belong to another panel).
        if (await this.isElementVisible(this.shipCodeSelect, 2000)) {
            console.log('✅ Panel already expanded');
            return;
        }

        await this.waitForElementToBeVisible(this.accordionHeader);
        await this.click(this.accordionHeader);
        await this.waitForElementToBeVisible(this.shipCodeSelect, 10000);
        console.log('✅ Configure Shipment panel expanded');
    }

    // ─── Ship Code / Carrier / Ship Method (PrimeNG p-select) ──

    /**
     * Select a Ship Code from the p-select dropdown.
     * Uses inputId="shipCode" or formControlName="shippingMethodConfig".
     */
    async selectShipCode(shipCodeText: string): Promise<void> {
        console.log(`Selecting Ship Code: "${shipCodeText}"...`);
        await this.selectPrimeNGDropdown(this.shipCodeSelect, shipCodeText, 8000, true);
        await this.page.waitForTimeout(500);
        console.log(`✅ Ship Code selected: "${shipCodeText}"`);
    }

    /**
     * Select a Carrier from the p-select dropdown in the Configure Shipment panel.
     * Uses inputId="carrier" or formControlName="carrierAccount".
     */
    async selectCarrier(carrierText: string): Promise<void> {
        console.log(`Selecting Carrier: "${carrierText}"...`);
        await this.selectPrimeNGDropdown(this.carrierSelect, carrierText, 8000);
        await this.page.waitForTimeout(500);
        console.log(`✅ Carrier selected: "${carrierText}"`);
    }

    /**
     * Select a Ship Method from the p-select dropdown.
     * Uses inputId="shipMethod" or formControlName="shippingMethod".
     */
    async selectShipMethod(methodText: string): Promise<void> {
        console.log(`Selecting Ship Method: "${methodText}"...`);
        await this.selectPrimeNGDropdown(this.shipMethodSelect, methodText, 8000);
        await this.page.waitForTimeout(500);
        console.log(`✅ Ship Method selected: "${methodText}"`);
    }

    /**
     * Select a Package Type from the p-select dropdown.
     */
    async selectPackageType(packageText: string): Promise<void> {
        console.log(`Selecting Package Type: "${packageText}"...`);
        await this.selectPrimeNGDropdown(this.packageTypeSelect, packageText, 8000);
        await this.page.waitForTimeout(500);
        console.log(`✅ Package Type selected: "${packageText}"`);
    }

    // ─── Exact selection and reading (carrier matrix) ────────────
    //
    // The matrix selects the option texts it read from the dropdowns, so these match the
    // whole text literally (selectShipCode matches a regex, which breaks on "Stamps.com" or
    // "UPS (Test)") and pick among repeated texts.

    /** Select a Ship Code by its whole option text; `occurrence` picks among repeated codes (1-based). */
    async selectShipCodeExact(shipCodeText: string, occurrence = 1): Promise<void> {
        await this.selectPrimeNGOptionExact(this.shipCodeSelect, shipCodeText, occurrence);
        await this.waitForXenvioLoading(15000);
        console.log(`✅ Ship Code selected: "${shipCodeText}"${occurrence > 1 ? ` (#${occurrence})` : ''}`);
    }

    async selectCarrierExact(carrierText: string): Promise<void> {
        await this.selectPrimeNGOptionExact(this.carrierSelect, carrierText);
        await this.waitForXenvioLoading(15000);
        console.log(`✅ Carrier selected: "${carrierText}"`);
    }

    async selectShipMethodExact(methodText: string): Promise<void> {
        await this.selectPrimeNGOptionExact(this.shipMethodSelect, methodText);
        await this.waitForXenvioLoading(15000);
        console.log(`✅ Ship Method selected: "${methodText}"`);
    }

    async selectPackageTypeExact(packageText: string): Promise<void> {
        await this.selectPrimeNGOptionExact(this.packageTypeSelect, packageText);
        console.log(`✅ Package Type selected: "${packageText}"`);
    }

    listShipCodeOptions(): Promise<string[]> {
        return this.readPrimeNGOptions(this.shipCodeSelect);
    }

    listCarrierOptions(): Promise<string[]> {
        return this.readPrimeNGOptions(this.carrierSelect);
    }

    /** Ship Methods of the selected carrier (they load after the carrier is chosen). */
    listShipMethodOptions(): Promise<string[]> {
        return this.readPrimeNGOptions(this.shipMethodSelect);
    }

    /**
     * Wait (without failing) until Ship Method shows a value: selecting a Ship Code fills
     * Carrier / Ship Method / Package Type, which can land after the loader is gone.
     */
    async waitForShipMethodFilled(timeoutMs = 5000): Promise<void> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline && !(await this.readPrimeNGValue(this.shipMethodSelect))) {
            await this.page.waitForTimeout(250);
        }
    }

    /** What the four dropdowns show right now (null = empty). */
    async readSelection(): Promise<{
        shipCode: string | null;
        carrier: string | null;
        shipMethod: string | null;
        packageType: string | null;
    }> {
        return {
            shipCode: await this.readPrimeNGValue(this.shipCodeSelect),
            carrier: await this.readPrimeNGValue(this.carrierSelect),
            shipMethod: await this.readPrimeNGValue(this.shipMethodSelect),
            packageType: await this.readPrimeNGValue(this.packageTypeSelect),
        };
    }

    // ─── Return Label (delegates to XenvioReturnLabelForm) ───────

    /** Check "Include return label". */
    async enableReturnLabel(): Promise<void> {
        await this.returnLabelForm.enableReturnLabel();
    }

    /** Open the "Set label info" form. */
    async openSetLabelInfo(): Promise<void> {
        await this.returnLabelForm.openSetLabelInfo();
    }

    async fillReturnLabelForm(data: {
        locationName: string;
        company: string;
        phone: string;
        email: string;
        parseAddress: string;
    }): Promise<void> {
        await this.returnLabelForm.fillReturnLabelForm(data);
    }

    async selectReturnCarrier(carrierText: string): Promise<void> {
        await this.returnLabelForm.selectReturnCarrier(carrierText);
    }

    async selectReturnShipCode(shipCodeText: string): Promise<void> {
        await this.returnLabelForm.selectReturnShipCode(shipCodeText);
    }

    async clickConfirm(): Promise<void> {
        await this.returnLabelForm.clickConfirm();
    }

    async clickCancel(): Promise<void> {
        await this.returnLabelForm.clickCancel();
    }

    /** Full return label configuration flow (checkbox → form → carrier/ship code → confirm). */
    async configureReturnLabel(data: {
        locationName: string;
        company: string;
        phone: string;
        email: string;
        parseAddress: string;
        carrier: string;
        shipCode: string;
    }): Promise<void> {
        await this.returnLabelForm.configure(data);
    }
}
