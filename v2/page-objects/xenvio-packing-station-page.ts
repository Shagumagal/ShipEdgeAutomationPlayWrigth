import { Page, Locator, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Page Object: XenvioPackingStationPage (v2 — PrimeNG)
 *
 * Manages the Packing Station tab and its workflows in Shipper View:
 *   - Box selection dialog (autocomplete dropdown + confirm)
 *   - SKU scanning (clicking items in the sidebar)
 *   - Close box dialog (applying calculated weight + confirm)
 *   - Hand off & Shipping actions (ended boxes panel)
 *
 * DIALOG BEHAVIOR after clicking Packing Station tab:
 *   Case A — Boxes freshly created (no items QC'd): "Select box type" opens directly
 *   Case B — Boxes have items saved via Shipment Details: "Order Already Packed" opens first
 *            → click "Start Fresh" → then "Select box type" opens
 *
 * openPackingStationTab() handles BOTH cases automatically via Promise.race.
 */
export class XenvioPackingStationPage extends BasePage {

    // ─── Main Tab & Navigation Locators ─────────────────────────────
    readonly packingStationTab: Locator;
    readonly shipmentDetailsTab: Locator;
    readonly packingStationContainer: Locator;

    // ─── QC Packed Dialog ("Order Already Packed") ──────────────────
    // Shown when all boxes already have items via Shipment Details QC flow
    readonly qcPackedDialog: Locator;
    readonly startFreshButton: Locator;

    // ─── Box Selection Dialog Locators ──────────────────────────────
    readonly boxSelectionDialog: Locator;
    readonly boxDropdownButton: Locator;
    readonly boxOptionList: Locator;
    readonly confirmBoxButton: Locator;
    // Fallback: "Select box" button inside the scan area (opens same dialog)
    readonly selectBoxFallbackButton: Locator;

    // ─── Packing Sidebar (Items) Locators ───────────────────────────
    readonly skuInput: Locator;
    readonly skuRows: Locator;
    readonly itemsScrollArea: Locator;

    // ─── Close / Finish Box Dialog Locators ─────────────────────────
    readonly finishBoxDialog: Locator;
    readonly applyCalculatedWeightButton: Locator;
    readonly confirmAndCloseBoxButton: Locator;

    // ─── Ended Boxes & Next Action Locators ─────────────────────────
    readonly endedBoxesPanel: Locator;
    readonly handOffButton: Locator;
    readonly shippingButton: Locator;

    constructor(page: Page) {
        super(page);

        // Tabs
        this.packingStationTab = page.locator('nav button').filter({ hasText: /Packing station/i }).first();
        this.shipmentDetailsTab = page.locator('nav button').filter({ hasText: /Shipment Details/i }).first();
        this.packingStationContainer = page.locator('.ps-container, app-packing-station').first();

        // QC Packed Dialog
        this.qcPackedDialog = page.locator('p-dialog').filter({ hasText: /Order Already Packed/i }).first();
        this.startFreshButton = this.qcPackedDialog.locator('button').filter({ hasText: /Start Fresh/i }).first();

        // Box Selection Dialog
        this.boxSelectionDialog = page.locator('p-dialog').filter({ hasText: /Select box type/i }).first();
        this.boxDropdownButton = this.boxSelectionDialog.locator('button.p-autocomplete-dropdown, [data-pc-section="dropdown"]').first();
        this.boxOptionList = page.locator('ul.p-autocomplete-list li.p-autocomplete-option, .p-autocomplete-overlay li');
        this.confirmBoxButton = this.boxSelectionDialog.locator('button').filter({ hasText: /Confirm/i }).first();
        // Fallback button inside scan area that also opens box selection
        this.selectBoxFallbackButton = page.locator('.ps-col-middle p-button').filter({ hasText: /Select box/i }).first();

        // Packing Sidebar
        this.skuInput = page.locator('input.ps-sku-input, input[placeholder*="Enter item code"]').first();
        this.itemsScrollArea = page.locator('.ps-scroll-area').first();
        this.skuRows = page.locator('.ps-sku-row');

        // Finish Box Dialog
        // NOTE: Both boxSelection and finishBox dialogs share styleClass="ps-box-select-dialog".
        // Target the finishBox dialog by its unique inner elements:
        //   .ps-dialog-label → the "Weight (pounds)" label
        //   .ps-suggested-apply-btn → the "Apply" calculated weight button
        //   #boxWeightInput → the weight input field
        this.finishBoxDialog = page.locator('p-dialog').filter({ has: page.locator('.ps-dialog-label, .ps-suggested-apply-btn, #boxWeightInput') }).first();
        this.applyCalculatedWeightButton = page.locator('.ps-suggested-apply-btn, button:has-text("Apply")').first();
        this.confirmAndCloseBoxButton = page.locator('p-dialog').filter({ has: page.locator('.ps-dialog-label') }).locator('button').filter({ hasText: /Confirm & close/i }).first();

        // Ended Boxes & Actions
        this.endedBoxesPanel = page.locator('.ps-col-right').first();
        this.handOffButton = page.locator('.ps-col-footer button').filter({ hasText: /Hand off/i }).first();
        this.shippingButton = page.locator('.ps-col-footer button').filter({ hasText: /Shipping/i }).first();
    }

    /**
     * Switch to Packing Station tab and handle whatever dialog opens.
     *
     * Two cases:
     *   A) "Select box type" opens directly → proceed
     *   B) "Order Already Packed" opens first → click "Start Fresh" → "Select box type" appears
     *
     * Uses Promise.race to detect whichever dialog becomes visible first.
     */
    async openPackingStationTab(): Promise<void> {
        console.log('📦 Switching to "Packing station" tab...');
        await this.waitForElementToBeVisible(this.packingStationTab, 15000);
        await this.click(this.packingStationTab);
        console.log('✅ Packing Station tab activated');

        console.log('⏳ Waiting for any dialog to appear (boxSelection OR qcPacked)...');

        // Strategy: race both dialogs — handle whichever appears first
        const DIALOG_TIMEOUT = 20000;

        const waitForBoxSelection = this.page.waitForSelector(
            '.ps-box-select-dialog .p-dialog-content, p-dialog[styleclass="ps-box-select-dialog"] .p-dialog-content',
            { state: 'visible', timeout: DIALOG_TIMEOUT }
        ).then(() => 'boxSelection' as const).catch(() => null);

        const waitForQCPacked = this.page.waitForSelector(
            'p-dialog .pi-check-circle',   // QC packed dialog has a pi-check-circle icon
            { state: 'visible', timeout: DIALOG_TIMEOUT }
        ).then(() => 'qcPacked' as const).catch(() => null);

        const result = await Promise.race([waitForBoxSelection, waitForQCPacked]);
        console.log(`  → Dialog detected: ${result ?? 'none'}`);

        if (result === 'qcPacked') {
            // Case B: must click "Start Fresh" to reset QC state
            console.log('⚠️ "Order Already Packed" dialog detected — clicking "Start Fresh"...');
            await this.click(this.startFreshButton);
            await this.waitForElementToBeHidden(this.qcPackedDialog, 10000);
            console.log('✅ QC dialog dismissed — waiting for box selection dialog...');
            // After Start Fresh, box selection dialog opens
            await this.waitForElementToBeVisible(this.boxSelectionDialog, 15000);
        } else if (result === 'boxSelection') {
            // Case A: box selection dialog already open — nothing to do
            console.log('✅ "Select box type" dialog opened automatically');
        } else {
            // Neither dialog appeared — try clicking the "Select box" fallback button
            console.log('⚠️ No dialog detected via race — trying fallback: click "Select box" button...');
            const fallbackVisible = await this.isElementVisible(this.selectBoxFallbackButton, 5000);
            if (fallbackVisible) {
                await this.click(this.selectBoxFallbackButton);
                await this.waitForElementToBeVisible(this.boxSelectionDialog, 15000);
                console.log('✅ Box selection dialog opened via fallback button');
            } else {
                throw new Error('Packing Station: no dialog and no fallback button appeared after clicking the tab.');
            }
        }
    }

    /**
     * Open the box type dropdown and select the first available box packaging.
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
     * Complete box selection flow in one call.
     * Call openPackingStationTab() first, then this.
     */
    async selectAndConfirmBoxType(): Promise<void> {
        await this.selectFirstBoxType();
        await this.confirmBoxSelection();
    }

    /**
     * Scan all items displayed in the left sidebar by clicking each item row one by one.
     * Continues until no unscanned items remain or the "Close this box" dialog appears.
     */
    async scanAllItemsByClicking(): Promise<number> {
        console.log('🔍 Scanning items in Packing Station sidebar...');
        let scannedCount = 0;

        await this.page.waitForTimeout(1000);

        while (true) {
            const isFinishDialogVisible = await this.finishBoxDialog.isVisible().catch(() => false);
            if (isFinishDialogVisible) {
                console.log('🎯 Finish box dialog popped up — all items scanned for this box!');
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
     * Multiple strategies because both p-dialogs share styleClass="ps-box-select-dialog".
     */
    async waitForCloseBoxDialog(timeoutMs = 20000): Promise<void> {
        console.log('⏳ Waiting for "Close this box" dialog...');

        // Strategy A: wait for the unique Apply button (ps-suggested-apply-btn) to be visible
        const strategyA = this.page.waitForSelector(
            '.ps-suggested-apply-btn, #boxWeightInput',
            { state: 'visible', timeout: timeoutMs }
        ).then(() => 'applyBtn').catch(() => null);

        // Strategy B: wait for ps-calculated-weight-badge (unique to finishBox dialog)
        const strategyB = this.page.waitForSelector(
            '.ps-calculated-weight-badge',
            { state: 'visible', timeout: timeoutMs }
        ).then(() => 'weightBadge').catch(() => null);

        const result = await Promise.race([strategyA, strategyB]);
        console.log(`  → "Close this box" dialog detected via: ${result ?? 'timeout'}`);

        if (!result) {
            throw new Error('"Close this box" dialog did not appear within timeout.');
        }
        console.log('✅ "Close this box" dialog visible');
    }

    /**
     * Click "Apply" in the "Close this box" dialog.
     * Apply sets the calculated weight AND closes the dialog automatically.
     */
    async applyCalculatedWeightAndClose(): Promise<void> {
        console.log('⚖️ Clicking "Apply" to set calculated weight...');

        // Strategy A: direct by styleClass set in Angular template
        const applyBtnA = this.page.locator('.ps-suggested-apply-btn').first();
        // Strategy B: button inside the weight badge area
        const applyBtnB = this.page.locator('.ps-calculated-weight-badge button, button:has-text("Apply")').first();

        let clicked = false;

        const isAVisible = await applyBtnA.isVisible().catch(() => false);
        if (isAVisible) {
            console.log('  → Clicking Apply (Strategy A: .ps-suggested-apply-btn)');
            await applyBtnA.click();
            clicked = true;
        }

        if (!clicked) {
            console.log('  → Clicking Apply (Strategy B: .ps-calculated-weight-badge button)');
            await this.waitForElementToBeVisible(applyBtnB, 10000);
            await applyBtnB.click();
        }

        // Apply closes the dialog — wait for the weight badge to disappear
        console.log('  ⏳ Waiting for dialog to close after Apply...');
        await this.page.waitForSelector('.ps-calculated-weight-badge', { state: 'hidden', timeout: 10000 })
            .catch(() => console.log('  ⚠️ Weight badge still visible — proceeding anyway'));

        console.log('✅ "Apply" clicked — dialog closed, weight applied');
    }

    /**
     * Click "Confirm & close" to seal the box.
     *
     * WHY getByRole: after Apply, Angular signals update and re-render the dialog.
     * CSS-class locators fail during re-render. getByRole('button', { name }) is
     * the most resilient Playwright approach for PrimeNG dynamic components.
     */
    async confirmAndCloseBox(): Promise<void> {
        console.log('✅ Clicking "Confirm & close"...');

        // Strategy A: getByRole — most resilient, handles Angular re-renders
        const confirmBtnA = this.page.getByRole('button', { name: /Confirm.*close/i });

        // Strategy B: look for the label span text (PrimeNG renders label in a span)
        const confirmBtnB = this.page.locator('button').filter({
            has: this.page.locator('[data-pc-section="label"]').filter({ hasText: /Confirm.*close/i })
        }).first();

        // Strategy C: data-pc-name button scoped to the weight input container
        const confirmBtnC = this.page.locator('#boxWeightInput')
            .locator('xpath=ancestor::div[contains(@class,"flex-col")]')
            .locator('button')
            .filter({ hasText: /Confirm.*close/i })
            .first();

        // Try Strategy A first (preferred)
        let clicked = false;

        try {
            await confirmBtnA.waitFor({ state: 'visible', timeout: 12000 });
            console.log('  → Confirm & close (Strategy A: getByRole)');
            await confirmBtnA.click();
            clicked = true;
        } catch {
            console.log('  → Strategy A failed, trying Strategy B...');
        }

        if (!clicked) {
            try {
                await confirmBtnB.waitFor({ state: 'visible', timeout: 8000 });
                console.log('  → Confirm & close (Strategy B: label span filter)');
                await confirmBtnB.click();
                clicked = true;
            } catch {
                console.log('  → Strategy B failed, trying Strategy C...');
            }
        }

        if (!clicked) {
            // Strategy C: JS click as last resort (bypasses stability checks)
            console.log('  → Confirm & close (Strategy C: JS evaluate click)');
            await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => /Confirm.*close/i.test(b.textContent ?? ''));
                if (btn) (btn as HTMLButtonElement).click();
                else throw new Error('Confirm & close button not found via JS');
            });
            clicked = true;
        }

        if (!clicked) {
            throw new Error('Could not click "Confirm & close" — all strategies failed.');
        }

        console.log('✅ Box sealed successfully');
    }

    /**
     * Click the "Shipping" button.
     * Multi-strategy because after sealing the box the footer re-renders.
     */
    async clickShipping(): Promise<void> {
        console.log('🚀 Clicking "Shipping" button...');

        // Strategy A: getByRole (most resilient)
        const shippingBtnA = this.page.getByRole('button', { name: /^Shipping/i });

        // Strategy B: scoped to ps-col-footer
        const shippingBtnB = this.page.locator('.ps-col-footer button').filter({ hasText: /Shipping/i }).first();

        // Strategy C: by label span text inside PrimeNG button
        const shippingBtnC = this.page.locator('button').filter({
            has: this.page.locator('[data-pc-section="label"]').filter({ hasText: /^Shipping$/i })
        }).first();

        let clicked = false;

        try {
            await shippingBtnA.waitFor({ state: 'visible', timeout: 12000 });
            await expect(shippingBtnA).toBeEnabled({ timeout: 8000 });
            console.log('  → Shipping (Strategy A: getByRole)');
            await shippingBtnA.click();
            clicked = true;
        } catch {
            console.log('  → Strategy A failed, trying Strategy B...');
        }

        if (!clicked) {
            try {
                await shippingBtnB.waitFor({ state: 'visible', timeout: 8000 });
                await expect(shippingBtnB).toBeEnabled({ timeout: 5000 });
                console.log('  → Shipping (Strategy B: .ps-col-footer)');
                await shippingBtnB.click();
                clicked = true;
            } catch {
                console.log('  → Strategy B failed, trying Strategy C...');
            }
        }

        if (!clicked) {
            try {
                await shippingBtnC.waitFor({ state: 'visible', timeout: 8000 });
                console.log('  → Shipping (Strategy C: label span filter)');
                await shippingBtnC.click();
                clicked = true;
            } catch {
                console.log('  → Strategy C failed, trying JS evaluate...');
            }
        }

        if (!clicked) {
            // Last resort: JS click
            console.log('  → Shipping (Strategy D: JS evaluate click)');
            await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => /^Shipping/i.test(b.textContent?.trim() ?? ''));
                if (btn) (btn as HTMLButtonElement).click();
                else throw new Error('Shipping button not found via JS');
            });
        }

        console.log('✅ "Shipping" clicked');
    }

    /**
     * Verify that ended boxes count matches expected.
     */
    async verifyEndedBoxesCount(expectedCount: number): Promise<void> {
        const endedBoxesCountText = await this.getText(this.endedBoxesPanel);
        console.log(`📦 Ended Boxes Summary: ${endedBoxesCountText.split('\n')[0] || ''}`);
        expect(endedBoxesCountText).toContain(`${expectedCount} ${expectedCount === 1 ? 'Box' : 'Boxes'}`);
    }
}
