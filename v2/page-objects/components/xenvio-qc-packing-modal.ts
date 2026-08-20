import { Page, expect } from "@playwright/test";
import BasePage from "../../../lib/basepage";

/**
 * Component: QC Packing Modal (v2 — PrimeNG)
 *
 * Handles QC Packing interactions.
 * The modal may now use p-dialog instead of mat-dialog-container.
 */
export class XenvioQCPackingModal extends BasePage {

    readonly qcPackingButton;

    constructor(page: Page) {
        super(page);
        this.qcPackingButton = page.locator('p-button, button').filter({ hasText: /QC Packing/i }).first();
    }

    /** Returns the currently visible dialog container. */
    private getActiveModal() {
        return this.page.locator('.p-dialog:visible, mat-dialog-container:visible, [role="dialog"]:visible').first();
    }

    /** Click the "QC Packing" button to open the modal. */
    async open(): Promise<void> {
        console.log('Opening QC Packing modal...');
        await this.page.waitForTimeout(1000);
        await this.waitForElementToBeVisible(this.qcPackingButton);
        await this.click(this.qcPackingButton);
        await this.page.waitForTimeout(1000);
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
            'button[aria-label^="Process item"]:visible, p-button[aria-label^="Process item"], button[aria-label^="Process item"]'
        );

        let processCount = await processButtons.count();
        while (processCount > 0) {
            const firstBtn = processButtons.first();
            await firstBtn.waitFor({ state: 'visible', timeout: 3000 });
            await firstBtn.click({ force: true });
            await this.page.waitForTimeout(600);
            processCount = await processButtons.count();
        }

        console.log('All items processed. Confirming QC Packing...');
        const confirmBtn = activeModal.locator('p-button, button').filter({ hasText: /Confirm/i }).first();
        await this.waitForElementToBeVisible(confirmBtn);
        await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
        await confirmBtn.click({ force: true });

        await this.page.waitForTimeout(1000);
        console.log('✅ QC Packing completed');
    }

    async processQCPacking(): Promise<void> {
        await this.open();
        await this.processAllItems();
    }
}
