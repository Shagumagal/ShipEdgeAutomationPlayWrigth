import { Page, expect } from "@playwright/test";
import BasePage from "../lib/basepage";
import { XenvioRatesModal } from "./components/xenvio-rates-modal";
import { XenvioQCPackingModal } from "./components/xenvio-qc-packing-modal";
import { XenvioBoxItemForm } from "./components/xenvio-box-item-form";

/**
 * Page Object: XenvioOrderToLabelPage  (Orchestrator)
 *
 * Manages the "Order-to-Label" flow in Shipper View.
 * Responsibilities kept here:
 *   - Navigation into the shipment panel
 *   - Action-bar buttons (GET RATES, SAVE & CONFIRM, GET LABELS)
 *   - Data capture (order details, selected rate)
 *
 * Delegates to:
 *   - this.ratesModal   → XenvioRatesModal
 *   - this.qcModal      → XenvioQCPackingModal
 *   - this.boxForm      → XenvioBoxItemForm
 *
 * Usage in tests:
 *   await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
 *   await orderToLabelPage.qcModal.processQCPacking();
 *   await orderToLabelPage.boxForm.fillBoxForm('2', '5', '10', '8', '6');
 */
export class XenvioOrderToLabelPage extends BasePage {

    // ─── Sub-components (public — accessible from tests) ─────────────
    readonly ratesModal: XenvioRatesModal;
    readonly qcModal: XenvioQCPackingModal;
    readonly boxForm: XenvioBoxItemForm;

    // ─── Action-bar locators ─────────────────────────────────────────
    readonly getRatesButton;
    readonly saveAndConfirmButton;
    readonly getLabelsButton;

    constructor(page: Page) {
        super(page);

        // Instantiate components
        this.ratesModal = new XenvioRatesModal(page);
        this.qcModal    = new XenvioQCPackingModal(page);
        this.boxForm    = new XenvioBoxItemForm(page);

        // Action-bar buttons
        this.getRatesButton       = page.locator('button[aria-label="GET RATES"]').first();
        this.saveAndConfirmButton = page.locator('button[aria-label="SAVE & CONFIRM"]').first();
        this.getLabelsButton      = page.locator('button[aria-label="GET LABELS"]').first();
    }

    // ─── Navigation ──────────────────────────────────────────────────

    /** Click on a shipment row in the shipper-view results table. */
    async clickShipmentRow(shipmentId: string): Promise<void> {
        console.log(`Clicking on shipment: ${shipmentId}`);
        const row = this.page.locator('td, span, a').filter({ hasText: shipmentId }).first();
        await this.waitForElementToBeVisible(row);
        await this.click(row);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log(`✅ Shipment ${shipmentId} opened`);
    }

    /** Expand the shipment details panel if it is collapsed. */
    async expandShipmentPanel(shipmentId?: string): Promise<void> {
        console.log('Expanding shipment panel...');
        const header = shipmentId
            ? this.page.locator('mat-expansion-panel-header').filter({ hasText: new RegExp(shipmentId, 'i') }).first()
            : this.page.locator('mat-expansion-panel-header').filter({ hasText: /Ship:/i }).first();

        if (await this.isElementVisible(header, 5000)) {
            const isExpanded = await header.getAttribute('aria-expanded');
            if (isExpanded !== 'true') {
                await this.click(header);
                await this.page.waitForTimeout(1000);
                console.log('✅ Shipment panel expanded');
            } else {
                console.log('✅ Shipment panel already expanded');
            }
        } else {
            const fallback = this.page.locator('.shipment-container mat-expansion-panel-header, mat-expansion-panel-header').first();
            if (await this.isElementVisible(fallback, 3000)) {
                await this.click(fallback);
                await this.page.waitForTimeout(1000);
                console.log('✅ Shipment panel expanded (fallback)');
            } else {
                console.log('⚠️ Could not find shipment panel to expand');
            }
        }
    }

    // ─── Action-bar Buttons ───────────────────────────────────────────

    /** Click the blue "GET RATES" button at the bottom of the screen. */
    async clickGetRates(): Promise<void> {
        console.log('Clicking Get Rates...');
        if (await this.isElementVisible(this.getRatesButton, 5000)) {
            await this.click(this.getRatesButton);
        } else {
            const fallback = this.page.locator('button').filter({ hasText: /^GET RATES$/i }).first();
            await this.click(fallback);
        }
        
        // Wait for the specific Xenvio loading spinner to finish (can take 10s+)
        await this.waitForXenvioLoading(30000); 
        await this.page.waitForTimeout(1000);
        console.log('✅ GET RATES clicked — results ready');
    }

    /** Click the green "SAVE & CONFIRM" button. */
    async clickSaveAndConfirm(): Promise<void> {
        console.log('Clicking Save & Confirm...');
        await this.waitForElementToBeVisible(this.saveAndConfirmButton);
        await expect(this.saveAndConfirmButton).toBeEnabled({ timeout: 10000 });
        await this.click(this.saveAndConfirmButton);
        
        await this.waitForXenvioLoading(30000);
        await this.page.waitForTimeout(1000);
        console.log('✅ SAVE & CONFIRM clicked');
    }

    /** Click the red "GET LABELS" button. */
    async clickGetLabels(timeoutMs: number = 60000): Promise<void> {
        console.log('Clicking Get Labels...');
        await this.waitForElementToBeVisible(this.getLabelsButton);
        await expect(this.getLabelsButton).toBeEnabled({ timeout: 15000 });
        await this.click(this.getLabelsButton);
        
        // Esperamos a que el spinner de carga (loading icon) desaparezca
        console.log('Waiting for labels to be generated (this might take a while)...');
        await this.waitForXenvioLoading(timeoutMs);
        
        await this.page.waitForTimeout(2000);
        console.log('✅ GET LABELS clicked and loading finished');
    }

    // ─── Data Capture ─────────────────────────────────────────────────

    /** Read the order/shipment details from labeled mat-form-fields. */
    async getOrderDetailsData(): Promise<Record<string, string>> {
        console.log('Capturing Order details...');
        const details: Record<string, string> = {};
        const labels = ['Order number', 'Shipment number', 'Status'];

        for (const label of labels) {
            const input = this.page
                .locator('mat-form-field')
                .filter({ hasText: new RegExp(label, 'i') })
                .locator('input')
                .first();
            if (await this.isElementVisible(input, 2000)) {
                details[label] = await input.inputValue();
            }
        }

        console.log(`📋 Order details: ${JSON.stringify(details)}`);
        return details;
    }

    /** Capture price and carrier from the confirmed-rate display. */
    async getSelectedRate(): Promise<{ price: string | null; carrier: string | null }> {
        const priceEl   = this.page.locator('.text-green-600, [class*="text-green"]').first();
        const carrierEl = this.page.locator('.text-xl.font-bold, [class*="carrier-name"]').first();

        const price   = await this.isElementVisible(priceEl, 2000)   ? await priceEl.textContent()   : null;
        const carrier = await this.isElementVisible(carrierEl, 2000) ? await carrierEl.textContent() : null;

        console.log(`💰 Selected rate: ${price ?? 'N/A'} | Carrier: ${carrier ?? 'N/A'}`);
        return { price: price?.trim() ?? null, carrier: carrier?.trim() ?? null };
    }

    // ─── Misc / Legacy compatibility ──────────────────────────────────

    /** Select a mat-select option by label + option text. */
    async selectMatOption(dropdownLabel: string, optionText: string): Promise<void> {
        console.log(`Selecting "${optionText}" from "${dropdownLabel}" dropdown...`);
        const dropdown = this.page.locator('mat-form-field').filter({ hasText: new RegExp(dropdownLabel, 'i') }).first();

        if (await this.isElementVisible(dropdown, 3000)) {
            await dropdown.click();
            await this.page.waitForTimeout(500);
            const option = this.page.locator('mat-option').filter({ hasText: new RegExp(optionText, 'i') }).first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Selected "${optionText}" from "${dropdownLabel}"`);
        }
    }

    /** Select a hazmat code from the dropdown. */
    async selectHazmatCode(code: string): Promise<void> {
        console.log(`Selecting Hazmat code: ${code}`);
        const select = this.page.locator('select#hazmatCode');
        await this.waitForElementToBeVisible(select);
        await select.selectOption(code);
        await this.page.waitForTimeout(500);
        console.log(`✅ Hazmat code selected: ${code}`);
    }
}
