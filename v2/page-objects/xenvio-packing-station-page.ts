import { Page, Locator, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Page Object: XenvioPackingStationPage (v2 — PrimeNG)
 *
 * Manages the Packing Station tab and its workflows in Shipper View:
 *   - Box selection dialog (autocomplete dropdown + confirm)
 *   - SKU scanning (clicking items in the sidebar)
 *   - Close box dialog (Apply = seals the box and closes dialog)
 *   - Shipping action (commit packed boxes)
 *
 * DIALOG BEHAVIOR after clicking Packing Station tab:
 *   Case A — Boxes freshly created: "Select box type" opens directly
 *   Case B — Boxes have items QC'd: "Order Already Packed" opens first
 *            → click "Start Fresh" → then "Select box type" opens
 *
 * openPackingStationTab() handles BOTH cases via Promise.race.
 */
export class XenvioPackingStationPage extends BasePage {

    // ─── Main Tab & Navigation ────────────────────────────────────
    readonly packingStationTab: Locator;
    readonly packingStationContainer: Locator;

    // ─── QC Packed Dialog ("Order Already Packed") ───────────────
    readonly qcPackedDialog: Locator;
    readonly startFreshButton: Locator;

    // ─── Box Selection Dialog ─────────────────────────────────────
    readonly boxSelectionDialog: Locator;
    readonly boxDropdownButton: Locator;
    readonly boxOptionList: Locator;
    readonly confirmBoxButton: Locator;
    readonly selectBoxFallbackButton: Locator;

    // ─── Packing Sidebar ──────────────────────────────────────────
    readonly skuRows: Locator;

    // ─── Ended Boxes Panel ────────────────────────────────────────
    readonly endedBoxesPanel: Locator;

    constructor(page: Page) {
        super(page);

        // Tabs
        this.packingStationTab = page.locator('nav button').filter({ hasText: /Packing station/i }).first();
        this.packingStationContainer = page.locator('.ps-container, app-packing-station').first();

        // QC Packed Dialog
        this.qcPackedDialog = page.locator('p-dialog').filter({ hasText: /Order Already Packed/i }).first();
        this.startFreshButton = this.qcPackedDialog.locator('button').filter({ hasText: /Start Fresh/i }).first();

        // Box Selection Dialog
        this.boxSelectionDialog = page.locator('p-dialog').filter({ hasText: /Select box type/i }).first();
        this.boxDropdownButton = this.boxSelectionDialog.locator('button.p-autocomplete-dropdown, [data-pc-section="dropdown"]').first();
        this.boxOptionList = page.locator('ul.p-autocomplete-list li.p-autocomplete-option, .p-autocomplete-overlay li');
        this.confirmBoxButton = this.boxSelectionDialog.locator('button').filter({ hasText: /Confirm/i }).first();
        this.selectBoxFallbackButton = page.locator('.ps-col-middle p-button').filter({ hasText: /Select box/i }).first();

        // Packing Sidebar — item rows to click
        this.skuRows = page.locator('.ps-sku-row');

        // Ended Boxes panel (right column)
        this.endedBoxesPanel = page.locator('.ps-col-right').first();
    }

    /**
     * Switch to Packing Station tab and handle whatever dialog opens.
     *
     * Case A: "Select box type" opens directly → proceed
     * Case B: "Order Already Packed" opens → click "Start Fresh" → box selection opens
     *
     * Uses Promise.race to detect whichever dialog appears first.
     */
    async openPackingStationTab(): Promise<void> {
        console.log('📦 Switching to "Packing station" tab...');
        await this.waitForElementToBeVisible(this.packingStationTab, 15000);
        await this.click(this.packingStationTab);
        console.log('✅ Packing Station tab activated');

        console.log('⏳ Waiting for any dialog to appear (boxSelection OR qcPacked)...');

        const DIALOG_TIMEOUT = 20000;

        const waitForBoxSelection = this.page.waitForSelector(
            '.ps-box-select-dialog .p-dialog-content, p-dialog[styleclass="ps-box-select-dialog"] .p-dialog-content',
            { state: 'visible', timeout: DIALOG_TIMEOUT }
        ).then(() => 'boxSelection' as const).catch(() => null);

        const waitForQCPacked = this.page.waitForSelector(
            'p-dialog .pi-check-circle',
            { state: 'visible', timeout: DIALOG_TIMEOUT }
        ).then(() => 'qcPacked' as const).catch(() => null);

        const result = await Promise.race([waitForBoxSelection, waitForQCPacked]);
        console.log(`  → Dialog detected: ${result ?? 'none'}`);

        if (result === 'qcPacked') {
            console.log('⚠️ "Order Already Packed" detected — clicking "Start Fresh"...');
            await this.click(this.startFreshButton);
            await this.waitForElementToBeHidden(this.qcPackedDialog, 10000);
            await this.waitForElementToBeVisible(this.boxSelectionDialog, 15000);
            console.log('✅ QC dialog dismissed — box selection dialog ready');
        } else if (result === 'boxSelection') {
            console.log('✅ "Select box type" dialog opened automatically');
        } else {
            // Fallback: try the in-scan-area "Select box" button
            console.log('⚠️ No dialog detected — trying fallback "Select box" button...');
            const fallbackVisible = await this.isElementVisible(this.selectBoxFallbackButton, 5000);
            if (fallbackVisible) {
                await this.click(this.selectBoxFallbackButton);
                await this.waitForElementToBeVisible(this.boxSelectionDialog, 15000);
                console.log('✅ Box selection dialog opened via fallback button');
            } else {
                throw new Error('Packing Station: no dialog appeared after clicking the tab.');
            }
        }
    }

    /**
     * Open the box type dropdown and select the first available packaging option.
     */
    async selectFirstBoxType(): Promise<void> {
        console.log('🔍 Clicking box type dropdown button...');
        await this.waitForElementToBeVisible(this.boxDropdownButton, 10000);
        await this.click(this.boxDropdownButton);

        console.log('📋 Selecting first box packaging option...');
        await this.page.waitForTimeout(500); // Allow overlay animation
        const firstOption = this.boxOptionList.first();
        await this.waitForElementToBeVisible(firstOption, 10000);
        const optionText = (await this.getText(firstOption)).replace(/\s+/g, ' ').trim();
        console.log(`  → Selected box type: ${optionText}`);
        await this.click(firstOption);
    }

    /**
     * Click Confirm in the box selection dialog.
     */
    async confirmBoxSelection(): Promise<void> {
        console.log('💾 Confirming box selection...');
        await this.waitForElementToBeVisible(this.confirmBoxButton, 10000);
        await expect(this.confirmBoxButton).toBeEnabled({ timeout: 10000 });
        await this.click(this.confirmBoxButton);
        await this.waitForElementToBeHidden(this.boxSelectionDialog, 10000);
        console.log('✅ Box confirmed and dialog closed');
    }

    /**
     * Full box selection in one call: open dropdown → pick first option → confirm.
     */
    async selectAndConfirmBoxType(): Promise<void> {
        await this.selectFirstBoxType();
        await this.confirmBoxSelection();
    }

    /**
     * Scan all items in the left sidebar by clicking each row.
     * Stops when the sidebar is empty or the "Close this box" dialog appears.
     */
    async scanAllItemsByClicking(): Promise<number> {
        console.log('🔍 Scanning items in Packing Station sidebar...');
        let scannedCount = 0;

        await this.page.waitForTimeout(1000);

        while (true) {
            // If the finish dialog appeared mid-scan, stop
            const finishDialogVisible = await this.page.locator('.ps-suggested-apply-btn').isVisible().catch(() => false);
            if (finishDialogVisible) {
                console.log('🎯 Finish box dialog appeared — all items scanned!');
                break;
            }

            const rowsCount = await this.skuRows.count();
            if (rowsCount === 0) {
                console.log(`✅ No more items left in sidebar (total scanned: ${scannedCount})`);
                break;
            }

            const currentRow = this.skuRows.first();
            const rowText = (await this.getText(currentRow)).replace(/\s+/g, ' ').trim();
            console.log(`  📝 Scanning item #${scannedCount + 1}: ${rowText}`);

            await this.click(currentRow);
            scannedCount++;
            await this.page.waitForTimeout(800);
        }

        return scannedCount;
    }

    /**
     * Wait for the "Close this box" dialog to appear.
     * Detects it via .ps-suggested-apply-btn (unique to this dialog).
     */
    async waitForCloseBoxDialog(timeoutMs = 20000): Promise<void> {
        console.log('⏳ Waiting for "Close this box" dialog...');
        await this.page.waitForSelector(
            '.ps-suggested-apply-btn, .ps-calculated-weight-badge',
            { state: 'visible', timeout: timeoutMs }
        );
        console.log('✅ "Close this box" dialog visible');
    }

    /**
     * Click "Apply" in the "Close this box" dialog.
     * Apply sets the calculated weight AND closes the dialog automatically.
     */
    async applyCalculatedWeightAndClose(): Promise<void> {
        console.log('⚖️ Clicking "Apply" to set calculated weight...');

        // Primary: direct styleClass from Angular template
        const applyBtn = this.page.locator('.ps-suggested-apply-btn').first();
        // Fallback: any button inside the calculated weight badge area
        const applyBtnFallback = this.page.locator('.ps-calculated-weight-badge button').first();

        const isPrimaryVisible = await applyBtn.isVisible().catch(() => false);
        if (isPrimaryVisible) {
            console.log('  → Clicking Apply (.ps-suggested-apply-btn)');
            await applyBtn.click();
        } else {
            console.log('  → Clicking Apply (fallback: .ps-calculated-weight-badge button)');
            await this.waitForElementToBeVisible(applyBtnFallback, 10000);
            await applyBtnFallback.click();
        }

        // Apply closes the dialog — wait for its unique element to disappear
        await this.page.waitForSelector('.ps-calculated-weight-badge', { state: 'hidden', timeout: 10000 })
            .catch(() => console.log('  ⚠️ Weight badge still visible — proceeding anyway'));

        console.log('✅ "Apply" clicked — dialog closed, weight applied');
    }

    /**
     * Click the "Shipping" button to commit packed boxes.
     * Uses getByRole (resilient to PrimeNG re-renders) with a JS fallback.
     */
    async clickShipping(): Promise<void> {
        console.log('🚀 Clicking "Shipping" button...');

        const shippingBtn = this.page.getByRole('button', { name: /^Shipping/i });

        try {
            await shippingBtn.waitFor({ state: 'visible', timeout: 12000 });
            await expect(shippingBtn).toBeEnabled({ timeout: 8000 });
            await shippingBtn.click();
            console.log('✅ "Shipping" clicked');
        } catch {
            // JS fallback for stubborn PrimeNG re-render cases
            console.log('  → getByRole failed — using JS evaluate fallback...');
            await this.page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button'))
                    .find(b => /^Shipping/i.test(b.textContent?.trim() ?? ''));
                if (btn) (btn as HTMLButtonElement).click();
                else throw new Error('Shipping button not found via JS');
            });
            console.log('✅ "Shipping" clicked (JS fallback)');
        }
    }

    /**
     * Verify that the ended boxes count in the right panel matches expected.
     */
    async verifyEndedBoxesCount(expectedCount: number): Promise<void> {
        const endedBoxesCountText = await this.getText(this.endedBoxesPanel);
        console.log(`📦 Ended Boxes Summary: ${endedBoxesCountText.split('\n')[0] || ''}`);
        expect(endedBoxesCountText).toContain(`${expectedCount} ${expectedCount === 1 ? 'Box' : 'Boxes'}`);
    }
}
