import { Page, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";
import { XenvioRatesModal } from "./components/xenvio-rates-modal";
import { XenvioQCPackingModal } from "./components/xenvio-qc-packing-modal";
import { XenvioBoxModal } from "./components/xenvio-box-modal";
import { XenvioItemModal } from "./components/xenvio-item-modal";
import { XenvioConfigureShipmentPanel } from "./components/xenvio-configure-shipment-panel";
import { XenvioCarrierRestrictionDialogV2 } from "./components/xenvio-carrier-restriction-dialog-v2";

/**
 * Page Object: XenvioOrderToLabelPage (v2 — PrimeNG)
 *
 * Manages the "Order-to-Label" flow in Shipper View.
 *
 * Key differences from legacy:
 *   - Action-bar buttons are now <p-button [label]="..."> (dynamic labels)
 *   - No more button[aria-label="GET RATES"] — use text matching instead
 *   - Shipment panel uses p-accordion instead of mat-expansion-panel
 *   - Box/Item forms are now DynamicDialog modals (delegated to box/item modals)
 *
 * Delegates to:
 *   - this.ratesModal   → XenvioRatesModal (v2)
 *   - this.qcModal      → XenvioQCPackingModal (v2)
 *   - this.boxModal     → XenvioBoxModal (v2 — NEW: DynamicDialog)
 *   - this.itemModal    → XenvioItemModal (v2 — NEW: DynamicDialog)
 *   - this.configPanel  → XenvioConfigureShipmentPanel (v2)
 */
export class XenvioOrderToLabelPage extends BasePage {

    // ─── Sub-components (public — accessible from tests) ─────────────
    readonly ratesModal: XenvioRatesModal;
    readonly qcModal: XenvioQCPackingModal;
    readonly boxModal: XenvioBoxModal;
    readonly itemModal: XenvioItemModal;
    readonly configPanel: XenvioConfigureShipmentPanel;
    readonly carrierRestriction: XenvioCarrierRestrictionDialogV2;

    /**
     * Legacy-compatible alias so workflows can use `orderToLabelPage.boxForm.xxx`
     * Maps to boxModal for box operations and itemModal for item operations.
     */
    readonly boxForm: {
        clickAddBox: () => Promise<void>;
        fillBoxForm: (name: string, weight: string, length: string, width: string, height: string) => Promise<void>;
        clickApplyBox: () => Promise<void>;
        clickAddItem: () => Promise<void>;
        clickAddItemForBox: (boxIndex: number) => Promise<void>;
        fillItemDetails: (item: any) => Promise<void>;
        fillInternationalItemDetails: (item: any) => Promise<void>;
        clickApplyItem: () => Promise<void>;
    };

    // ─── Action-bar locators (PrimeNG p-button with dynamic labels) ──
    readonly getRatesButton;
    readonly saveAndConfirmButton;
    readonly getLabelsButton;

    constructor(page: Page) {
        super(page);

        // Instantiate v2 components
        this.ratesModal          = new XenvioRatesModal(page);
        this.qcModal             = new XenvioQCPackingModal(page);
        this.boxModal            = new XenvioBoxModal(page);
        this.itemModal           = new XenvioItemModal(page);
        this.configPanel         = new XenvioConfigureShipmentPanel(page);
        this.carrierRestriction  = new XenvioCarrierRestrictionDialogV2(page);

        // Action-bar buttons — p-button with text labels
        this.getRatesButton       = page.locator('p-button, button').filter({ hasText: /^GET RATES$/i }).first();
        this.saveAndConfirmButton = page.locator('p-button, button').filter({ hasText: /SAVE.*CONFIRM/i }).first();
        this.getLabelsButton      = page.locator('p-button, button').filter({ hasText: /^GET LABELS$/i }).first();

        // Legacy-compatible boxForm bridge
        this.boxForm = {
            clickAddBox: () => this.boxModal.clickAddBox(),
            fillBoxForm: (name, weight, length, width, height) => this.boxModal.fillBoxForm(name, weight, length, width, height),
            clickApplyBox: () => this.boxModal.clickApplyBox(),
            clickAddItem: () => this.itemModal.clickAddItem(),
            clickAddItemForBox: (boxIndex) => this.itemModal.clickAddItemForBox(boxIndex),
            fillItemDetails: (item) => this.itemModal.fillItemDetails(item),
            fillInternationalItemDetails: (item) => this.itemModal.fillInternationalItemDetails(item),
            clickApplyItem: () => this.itemModal.clickApplyItem(),
        };
    }

    // ─── Navigation ──────────────────────────────────────────────────

    /**
     * Wait for the shipment detail page to be fully loaded after order creation.
     *
     * The system auto-redirects to shipper-view?shipment_number=XXX after saving a new order.
     * We confirm it's ready by waiting for:
     *   1. The URL to contain shipper-view?shipment_number=
     *   2. The GET RATES p-button to be visible in the action bar
     */
    async waitForShipmentDetailReady(timeout = 30000): Promise<void> {
        console.log('Waiting for shipment detail to load...');

        // 1. Confirm we're on the correct URL
        await this.page.waitForURL(/shipper-view\?shipment_number=/, { timeout });
        console.log('  ✅ URL confirmed: shipper-view?shipment_number=...');

        // 2. Wait for network to settle
        await this.page.waitForLoadState('networkidle');

        // 3. The most reliable signal: GET RATES button visible in the action bar
        await this.getRatesButton.waitFor({ state: 'visible', timeout });
        console.log('  ✅ Action bar ready (GET RATES button visible)');
    }

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

        // Try p-accordion first (PrimeNG)
        const accordionHeader = shipmentId
            ? this.page.locator('p-accordion-header').filter({ hasText: new RegExp(shipmentId, 'i') }).first()
            : this.page.locator('p-accordion-header').filter({ hasText: /Ship:/i }).first();

        if (await this.isElementVisible(accordionHeader, 3000)) {
            await this.click(accordionHeader);
            await this.page.waitForTimeout(1000);
            console.log('✅ Shipment panel expanded (p-accordion)');
            return;
        }

        // Fallback: mat-expansion-panel (still used in some views)
        const matHeader = shipmentId
            ? this.page.locator('mat-expansion-panel-header').filter({ hasText: new RegExp(shipmentId, 'i') }).first()
            : this.page.locator('mat-expansion-panel-header').filter({ hasText: /Ship:/i }).first();

        if (await this.isElementVisible(matHeader, 5000)) {
            const isExpanded = await matHeader.getAttribute('aria-expanded');
            if (isExpanded !== 'true') {
                await this.click(matHeader);
                await this.page.waitForTimeout(1000);
                console.log('✅ Shipment panel expanded (mat-expansion)');
            } else {
                console.log('✅ Shipment panel already expanded');
            }
        } else {
            // Last fallback
            const fallback = this.page.locator('mat-expansion-panel-header, p-accordion-header').first();
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

    /** Click the "GET RATES" p-button. */
    async clickGetRates(): Promise<void> {
        console.log('Clicking Get Rates...');
        if (await this.isElementVisible(this.getRatesButton, 5000)) {
            await this.click(this.getRatesButton);
        } else {
            // Fallback: legacy aria-label selector
            const fallback = this.page.locator('button[aria-label="GET RATES"], button:has-text("GET RATES")').first();
            await this.click(fallback);
        }

        await this.waitForXenvioLoading(30000);
        await this.page.waitForTimeout(1000);
        console.log('✅ GET RATES clicked — results ready');
    }

    /** Click the "SAVE & CONFIRM" p-button. */
    async clickSaveAndConfirm(): Promise<void> {
        console.log('Clicking Save & Confirm...');
        await this.waitForElementToBeVisible(this.saveAndConfirmButton, 10000);
        await expect(this.saveAndConfirmButton).toBeEnabled({ timeout: 10000 });
        await this.click(this.saveAndConfirmButton);

        await this.waitForXenvioLoading(30000);
        await this.page.waitForTimeout(1000);
        console.log('✅ SAVE & CONFIRM clicked');
    }

    /** Click the "GET LABELS" p-button. */
    async clickGetLabels(timeoutMs: number = 90000): Promise<void> {
        console.log('Clicking Get Labels...');
        await this.waitForElementToBeVisible(this.getLabelsButton);
        await expect(this.getLabelsButton).toBeEnabled({ timeout: 15000 });
        await this.click(this.getLabelsButton);

        console.log('Waiting for labels to be generated (this might take a while)...');
        await this.waitForXenvioLoading(timeoutMs);

        await expect(this.page).toHaveURL(/.*shipper-view.*/, { timeout: 30000 });

        // Wait for VOID LABEL button or VOID SHIPPING LABELS (PrimeNG label)
        const voidLabelBtn = this.page.locator(
            'p-button:has-text("VOID"), button:has-text("VOID LABEL"), button:has-text("VOID SHIPPING LABELS"), button[aria-label="VOID LABEL"]'
        ).first();
        await voidLabelBtn.waitFor({ state: 'visible', timeout: timeoutMs });

        await this.page.waitForTimeout(2000);
        console.log('✅ GET LABELS clicked and loading finished');
    }

    // ─── Data Capture ─────────────────────────────────────────────────

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

    async getSelectedRate(): Promise<{ price: string | null; carrier: string | null }> {
        const priceEl   = this.page.locator('.text-green-600, [class*="text-green"]').first();
        const carrierEl = this.page.locator('.text-xl.font-bold, [class*="carrier-name"]').first();

        const price   = await this.isElementVisible(priceEl, 2000)   ? await priceEl.textContent()   : null;
        const carrier = await this.isElementVisible(carrierEl, 2000) ? await carrierEl.textContent() : null;

        console.log(`💰 Selected rate: ${price ?? 'N/A'} | Carrier: ${carrier ?? 'N/A'}`);
        return { price: price?.trim() ?? null, carrier: carrier?.trim() ?? null };
    }

    // ─── Task Label Result Capture ────────────────────────────────────

    async captureTaskLabelResult(): Promise<{
        finalPostage: number | null;
        shippingCost: number | null;
        labelUrls: string[];
        docUrls: string[];
    }> {
        console.log('\n📬 Capturing label task result...');

        const result = {
            finalPostage: null as number | null,
            shippingCost: null as number | null,
            labelUrls:    [] as string[],
            docUrls:      [] as string[],
        };

        try {
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

        console.log('\n══════════════════════════════════════════════');
        console.log('  📦 LABEL TASK RESULT');
        console.log('══════════════════════════════════════════════');
        console.log(`  💰 finalPostage  : ${result.finalPostage  ?? 'N/A'}`);
        console.log(`  💳 shippingCost  : ${result.shippingCost  ?? 'N/A'}`);

        if (result.labelUrls.length > 0) {
            console.log('\n  🏷️  LABEL URL(s)  — CMD+Click to open:');
            result.labelUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
        }
        if (result.docUrls.length > 0) {
            console.log('\n  📄  DOCUMENT URL(s) — CMD+Click to open:');
            result.docUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
        }
        console.log('══════════════════════════════════════════════\n');

        return result;
    }
}
