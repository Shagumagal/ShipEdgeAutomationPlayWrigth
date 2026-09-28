import { Page } from "@playwright/test";
import BasePage from "../../lib/basepage";
import { XenvioRatesModal } from "./components/xenvio-rates-modal";
import { XenvioQCPackingModal } from "./components/xenvio-qc-packing-modal";
import { XenvioBoxModal } from "./components/xenvio-box-modal";
import { XenvioItemModal } from "./components/xenvio-item-modal";
import { XenvioConfigureShipmentPanel } from "./components/xenvio-configure-shipment-panel";
import { XenvioCarrierRestrictionDialogV2 } from "./components/xenvio-carrier-restriction-dialog-v2";
import { XenvioShipmentActionBar } from "./components/xenvio-shipment-action-bar";
import { XenvioShipmentDetailReader } from "./components/xenvio-shipment-detail-reader";

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
 *   - this.actionBar    → XenvioShipmentActionBar (buttons + their waits)
 *   - this.detail       → XenvioShipmentDetailReader (reading order/rate/label data)
 *
 * This page object owns navigation inside the shipment detail; the action-bar and
 * data-reading methods below delegate and keep their original names, so tests,
 * services and workflows are unaffected.
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

    // ─── Action bar and data reading ─────────────────────────────────
    readonly actionBar: XenvioShipmentActionBar;
    readonly detail: XenvioShipmentDetailReader;

    // ─── Action-bar locators (kept here for existing callers) ────────
    readonly getRatesButton;
    readonly saveAndConfirmButton;
    readonly getLabelsButton;
    readonly voidLabelsButton;
    /** Shown when the automatic return label call fails (e.g. error 1008). */
    readonly getReturnLabelButton;
    /** PrimeNG toast "Success — Return label created successfully" (disappears after a few seconds). */
    readonly returnLabelSuccessToast;

    constructor(page: Page) {
        super(page);

        // Instantiate v2 components
        this.ratesModal = new XenvioRatesModal(page);
        this.qcModal = new XenvioQCPackingModal(page);
        this.boxModal = new XenvioBoxModal(page);
        this.itemModal = new XenvioItemModal(page);
        this.configPanel = new XenvioConfigureShipmentPanel(page);
        this.carrierRestriction = new XenvioCarrierRestrictionDialogV2(page);

        this.actionBar = new XenvioShipmentActionBar(page);
        this.detail = new XenvioShipmentDetailReader(page);

        // Same locators as before, now owned by the action bar
        this.getRatesButton = this.actionBar.getRatesButton;
        this.saveAndConfirmButton = this.actionBar.saveAndConfirmButton;
        this.getLabelsButton = this.actionBar.getLabelsButton;
        this.voidLabelsButton = this.actionBar.voidLabelsButton;
        this.getReturnLabelButton = this.actionBar.getReturnLabelButton;
        this.returnLabelSuccessToast = this.actionBar.returnLabelSuccessToast;

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

    // ─── Action bar (delegates to XenvioShipmentActionBar) ───────────

    async clickGetRates(): Promise<void> {
        await this.actionBar.clickGetRates();
    }

    async clickSaveAndConfirm(): Promise<void> {
        await this.actionBar.clickSaveAndConfirm();
    }

    async clickGetLabels(timeoutMs: number = 90000): Promise<void> {
        await this.actionBar.clickGetLabels(timeoutMs);
    }

    /** Click GET LABELS without waiting for the result. */
    async pressGetLabels(): Promise<void> {
        await this.actionBar.pressGetLabels();
    }

    /** Wait until the label exists (VOID button visible). */
    async waitForLabelsGenerated(timeoutMs: number = 90000): Promise<void> {
        await this.actionBar.waitForLabelsGenerated(timeoutMs);
    }

    async clickVoidLabel(): Promise<void> {
        await this.actionBar.clickVoidLabel();
    }

    async confirmVoidLabelDialog(timeoutMs: number = 120000): Promise<void> {
        await this.actionBar.confirmVoidLabelDialog(timeoutMs);
    }

    /** Click "Confirm" in the void dialog without waiting for the void. */
    async clickConfirmVoidDialog(): Promise<void> {
        await this.actionBar.clickConfirmVoidDialog();
    }

    /** Wait until GET LABELS is back after a void. */
    async waitForVoidCompleted(timeoutMs: number = 120000): Promise<void> {
        await this.actionBar.waitForVoidCompleted(timeoutMs);
    }

    /** Close visible PrimeNG error toasts (best effort, never throws). */
    async dismissErrorToasts(): Promise<void> {
        await this.actionBar.dismissErrorToasts();
    }

    // ─── Data reading (delegates to XenvioShipmentDetailReader) ──────

    async getOrderDetailsData(): Promise<Record<string, string>> {
        return this.detail.getOrderDetailsData();
    }

    async getSelectedRate(): Promise<{ price: string | null; carrier: string | null }> {
        return this.detail.getSelectedRate();
    }

    async captureTaskLabelResult(): Promise<{
        finalPostage: number | null;
        shippingCost: number | null;
        labelUrls: string[];
        docUrls: string[];
    }> {
        return this.detail.captureTaskLabelResult();
    }
}
