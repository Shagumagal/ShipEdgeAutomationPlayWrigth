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

    constructor(page: Page) {
        super(page);

        this.returnLabelForm = new XenvioReturnLabelForm(page);

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
