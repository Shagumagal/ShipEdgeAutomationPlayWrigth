import { Page, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: QC Packing Modal
 *
 * Handles all interactions within the QC Packing modal:
 * opening it, processing items one by one, and confirming.
 *
 * Follows the project POM pattern: locators declared as readonly
 * in the constructor (see docs/04-page-objects.md).
 */
export class XenvioQCPackingModal extends BasePage {

    readonly qcPackingButton;
    // Note: the active modal locator is dynamic (uses :visible pseudo-class),
    // so it can't be a static readonly. It is resolved at call time.

    constructor(page: Page) {
        super(page);
        // Angular may keep hidden modal "cadavers" in the DOM.
        // The specific modal container is resolved dynamically in methods.
        this.qcPackingButton = page.locator('button').filter({ hasText: /QC Packing/i }).first();
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    /** Returns the currently visible modal container — avoids hidden Angular ghosts. */
    private getActiveModal() {
        return this.page.locator('mat-dialog-container:visible').first();
    }

    // ─── Actions ─────────────────────────────────────────────────────

    /** Click the "QC Packing" button to open the modal. */
    async open(): Promise<void> {
        console.log('Opening QC Packing modal...');
        await this.page.waitForTimeout(1000); // Allow card to finish loading
        await this.waitForElementToBeVisible(this.qcPackingButton);
        await this.click(this.qcPackingButton);
        await this.page.waitForTimeout(1000); // Wait for modal to render
        console.log('✅ QC Packing modal opened');
    }

    /**
     * Click every "Process item" button inside the modal until none remain,
     * then clicks "Confirm" to close.
     */
    async processAllItems(): Promise<void> {
        console.log('Processing items in QC Packing modal...');
        const activeModal = this.getActiveModal();
        await activeModal.waitFor({ state: 'visible', timeout: 5000 });

        const processButtons = activeModal.locator(
            'button[aria-label^="Process item"]:visible, button[aria-label^="Process item"]'
        );

        let processCount = await processButtons.count();
        while (processCount > 0) {
            const firstBtn = processButtons.first();
            await firstBtn.waitFor({ state: 'visible', timeout: 3000 });
            await firstBtn.click({ force: true });
            await this.page.waitForTimeout(600); // Wait for item animation to settle
            processCount = await processButtons.count();
        }

        console.log('All items processed. Confirming QC Packing...');
        const confirmBtn = activeModal.locator('button').filter({ hasText: /Confirm/i }).first();
        await this.waitForElementToBeVisible(confirmBtn);
        await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
        await confirmBtn.click({ force: true });

        await this.page.waitForTimeout(1000); // Wait for modal to close
        console.log('✅ QC Packing completed');
    }

    /**
     * Convenience method: opens the modal and processes all items in one call.
     * Equivalent to the old `processQCPacking()` on the page object.
     */
    async processQCPacking(): Promise<void> {
        await this.open();
        await this.processAllItems();
    }
}
