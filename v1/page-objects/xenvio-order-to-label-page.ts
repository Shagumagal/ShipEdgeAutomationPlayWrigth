import { Page, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";
import { XenvioRatesModal } from "./components/xenvio-rates-modal";
import { XenvioQCPackingModal } from "./components/xenvio-qc-packing-modal";
import { XenvioBoxItemForm } from "./components/xenvio-box-item-form";
import { XenvioConfigureShipmentPanel } from "./components/xenvio-configure-shipment-panel";
import { XenvioCarrierRestrictionDialog } from "./components/xenvio-carrier-restriction-dialog";

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
 *   - this.configPanel  → XenvioConfigureShipmentPanel
 *
 * Usage in tests:
 *   await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
 *   await orderToLabelPage.qcModal.processQCPacking();
 *   await orderToLabelPage.boxForm.fillBoxForm('2', '5', '10', '8', '6');
 *   await orderToLabelPage.configPanel.configureReturnLabel(data);
 */
export class XenvioOrderToLabelPage extends BasePage {

    // ─── Sub-components (public — accessible from tests) ─────────────
    readonly ratesModal: XenvioRatesModal;
    readonly qcModal: XenvioQCPackingModal;
    readonly boxForm: XenvioBoxItemForm;
    readonly configPanel: XenvioConfigureShipmentPanel;
    readonly carrierRestriction: XenvioCarrierRestrictionDialog;

    // ─── Action-bar locators ─────────────────────────────────────────
    readonly getRatesButton;
    readonly saveAndConfirmButton;
    readonly getLabelsButton;

    constructor(page: Page) {
        super(page);

        // Instantiate components
        this.ratesModal        = new XenvioRatesModal(page);
        this.qcModal           = new XenvioQCPackingModal(page);
        this.boxForm           = new XenvioBoxItemForm(page);
        this.configPanel       = new XenvioConfigureShipmentPanel(page);
        this.carrierRestriction = new XenvioCarrierRestrictionDialog(page);

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
    async clickGetLabels(timeoutMs: number = 90000): Promise<void> {
        console.log('Clicking Get Labels...');
        await this.waitForElementToBeVisible(this.getLabelsButton);
        await expect(this.getLabelsButton).toBeEnabled({ timeout: 15000 });
        await this.click(this.getLabelsButton);
        
        // Esperamos a que el spinner de carga (loading icon) desaparezca
        console.log('Waiting for labels to be generated (this might take a while)...');
        await this.waitForXenvioLoading(timeoutMs);
        
        // Esperar a que la URL se estabilice en la vista del shipper
        await expect(this.page).toHaveURL(/.*shipper-view.*/, { timeout: 30000 });

        // Esperar a que el botón VOID LABEL sea visible para asegurar que la UI terminó de cargar la etiqueta
        const voidLabelBtn = this.page.locator('button:has-text("VOID LABEL"), button[aria-label="VOID LABEL"], button:has-text("Void Label")').first();
        await voidLabelBtn.waitFor({ state: 'visible', timeout: timeoutMs });
        
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

    // ─── Task Label Result Capture ────────────────────────────────────

    /**
     * After GET LABELS completes, captures the label result data from the
     * task_executor API response in the browser's network activity.
     *
     * Extracts and logs:
     *   - finalPostage
     *   - shippingCost
     *   - label URL(s) (printable via CMD+Click in terminal)
     *   - doc URL(s) such as commercial invoice PDFs
     *
     * Uses page.evaluate() to read the last task_executor JSON already loaded in memory.
     * Falls back to parsing visible text in the UI if network capture is unavailable.
     */
    async captureTaskLabelResult(): Promise<{
        finalPostage: number | null;
        shippingCost: number | null;
        labelUrls: string[];
        docUrls: string[];
    }> {
        console.log('\n📬 Capturing label task result...');

        // Strategy 1: Read from the visible task executor panel in the UI
        // The panel renders as a JSON block or card after GET LABELS completes
        const result = {
            finalPostage: null as number | null,
            shippingCost: null as number | null,
            labelUrls:    [] as string[],
            docUrls:      [] as string[],
        };

        try {
            // Try to find visible JSON text in the task executor panel
            const taskPanel = this.page.locator(
                '[class*="task"], [id*="task"], pre, code, .json-viewer, mat-card'
            ).filter({ hasText: /finalPostage|shippingCost|task_executor/i }).first();

            if (await this.isElementVisible(taskPanel, 5000)) {
                const rawText = await taskPanel.textContent();
                if (rawText) {
                    const finalPostageMatch = rawText.match(/"finalPostage"\s*:\s*([\d.]+)/);
                    const shippingCostMatch  = rawText.match(/"shippingCost"\s*:\s*([\d.]+)/);
                    if (finalPostageMatch) result.finalPostage = parseFloat(finalPostageMatch[1]);
                    if (shippingCostMatch)  result.shippingCost  = parseFloat(shippingCostMatch[1]);

                    const labelUrlMatches = [...rawText.matchAll(/https?:\/\/[^\s"]+\.pdf[^\s"]*/gi)];
                    for (const m of labelUrlMatches) {
                        const url = m[0].replace(/[",]/g, '').trim();
                        if (url.includes('invoice') || url.includes('commercial')) {
                            result.docUrls.push(url);
                        } else {
                            result.labelUrls.push(url);
                        }
                    }
                }
            }
        } catch {
            console.log('  ⚠ Could not read task panel text directly');
        }

        // Strategy 2: Look for anchor tags with PDF links rendered in the UI
        if (result.labelUrls.length === 0 && result.docUrls.length === 0) {
            try {
                const pdfLinks = await this.page.locator('a[href*=".pdf"]').all();
                for (const link of pdfLinks) {
                    const href = await link.getAttribute('href') ?? '';
                    if (!href) continue;
                    const fullUrl = href.startsWith('http') ? href : `${this.page.url().split('/').slice(0, 3).join('/')}${href}`;
                    if (fullUrl.toLowerCase().includes('invoice') || fullUrl.toLowerCase().includes('commercial')) {
                        result.docUrls.push(fullUrl);
                    } else {
                        result.labelUrls.push(fullUrl);
                    }
                }
            } catch {
                console.log('  ⚠ Could not capture PDF anchor links');
            }
        }

        // ── Print results to console (CMD+Click friendly) ──────────────
        console.log('\n══════════════════════════════════════════════');
        console.log('  📦 LABEL TASK RESULT');
        console.log('══════════════════════════════════════════════');
        console.log(`  💰 finalPostage  : ${result.finalPostage  ?? 'N/A'}`);
        console.log(`  💳 shippingCost  : ${result.shippingCost  ?? 'N/A'}`);

        if (result.labelUrls.length > 0) {
            console.log('\n  🏷️  LABEL URL(s)  — CMD+Click to open:');
            result.labelUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
        } else {
            console.log('\n  🏷️  LABEL URL(s)  : Not captured in UI (check Allure screenshot)');
        }

        if (result.docUrls.length > 0) {
            console.log('\n  📄  DOCUMENT URL(s) — CMD+Click to open:');
            result.docUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
        } else {
            console.log('\n  📄  DOCUMENT URL(s) : Not captured in UI');
        }

        console.log('══════════════════════════════════════════════\n');

        return result;
    }
}
