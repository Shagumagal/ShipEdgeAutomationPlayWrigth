import { Page, expect } from "@playwright/test";
import BasePage from "../base-page";

/**
 * Component: Shipment action bar (v2 — PrimeNG)
 *
 * The buttons at the top of the shipment detail (GET RATES, SAVE & CONFIRM, GET LABELS,
 * VOID SHIPPING LABELS, GET RETURN LABEL) and the waits that follow each of them.
 *
 * Each action is split in two halves — press (click) and wait (result) — so a workflow can
 * watch for a carrier error while the UI wait runs (see workflows/carrier-retry-runner.ts).
 */
export class XenvioShipmentActionBar extends BasePage {

    readonly getRatesButton;
    readonly saveAndConfirmButton;
    readonly getLabelsButton;
    readonly voidLabelsButton;
    /** PrimeNG p-confirmDialog (key "delete-shipment-label") opened by VOID SHIPPING LABELS. */
    readonly voidConfirmDialog;
    readonly voidConfirmDeleteButton;
    /** Shown when the automatic return label call fails (e.g. error 1008). */
    readonly getReturnLabelButton;
    /** PrimeNG toast "Success — Return label created successfully" (disappears after a few seconds). */
    readonly returnLabelSuccessToast;

    constructor(page: Page) {
        super(page);

        this.getRatesButton = page.locator('p-button, button').filter({ hasText: /^GET RATES$/i }).first();
        this.saveAndConfirmButton = page.locator('p-button, button').filter({ hasText: /SAVE.*CONFIRM/i }).first();
        this.getLabelsButton = page.locator('p-button, button').filter({ hasText: /^GET LABELS$/i }).first();
        this.voidLabelsButton = page.locator('p-button, button')
            .filter({ hasText: /VOID\s*(SHIPPING\s*)?LABELS?/i })
            .first();
        this.voidConfirmDialog = page.getByRole('alertdialog', { name: /Delete Shipment Label/i });
        this.voidConfirmDeleteButton = this.voidConfirmDialog.getByRole('button', { name: /^Delete$/i });
        this.getReturnLabelButton = page.locator('p-button').filter({ hasText: /GET RETURN LABEL/i }).first();
        this.returnLabelSuccessToast = page.locator('.p-toast-message, [data-pc-section="message"]')
            .filter({ hasText: /Return label created successfully/i })
            .first();
    }

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
        await this.pressGetLabels();
        await this.waitForLabelsGenerated(timeoutMs);
    }

    /** First half of clickGetLabels: click GET LABELS without waiting for the result. */
    async pressGetLabels(): Promise<void> {
        console.log('Clicking Get Labels...');
        await this.waitForElementToBeVisible(this.getLabelsButton);
        await expect(this.getLabelsButton).toBeEnabled({ timeout: 15000 });
        await this.click(this.getLabelsButton);
    }

    /** Second half of clickGetLabels: wait until the label exists (VOID button visible). */
    async waitForLabelsGenerated(timeoutMs: number = 90000): Promise<void> {
        console.log('Waiting for labels to be generated (this might take a while)...');
        await this.waitForXenvioLoading(timeoutMs);

        await expect(this.page).toHaveURL(/.*shipper-view.*/, { timeout: 30000 });

        // Wait for VOID LABEL button or VOID SHIPPING LABELS (PrimeNG label)
        await this.voidLabelsButton.waitFor({ state: 'visible', timeout: timeoutMs });

        await this.page.waitForTimeout(2000);
        console.log('✅ GET LABELS clicked and loading finished');
    }

    /**
     * Click the "VOID SHIPPING LABELS" p-button.
     * This button appears after a label has been successfully generated (shipment is 'shipped').
     * It replaces the "GET LABELS" button in the action bar.
     */
    async clickVoidLabel(): Promise<void> {
        console.log('Clicking VOID SHIPPING LABELS...');
        await this.waitForElementToBeVisible(this.voidLabelsButton, 15000);
        await expect(this.voidLabelsButton).toBeEnabled({ timeout: 10000 });
        await this.click(this.voidLabelsButton);
        console.log('✅ VOID SHIPPING LABELS button clicked');
    }

    /**
     * Accept the "Delete Shipment Label" dialog without waiting for the void.
     *
     * Source: shipper-view.component (PrimeNG ConfirmationService, key "delete-shipment-label")
     *   - Header: "Delete Shipment Label"
     *   - Message: "Are you sure you want to delete the shipment label?..."
     *   - Buttons: "Cancel" | "Delete"
     */
    async clickConfirmVoidDialog(): Promise<void> {
        console.log('Waiting for Void Label confirmation dialog...');
        await this.waitForElementToBeVisible(this.voidConfirmDialog, 15000);
        console.log('  ✅ Confirmation dialog visible: "Delete Shipment Label"');

        await this.click(this.voidConfirmDeleteButton);
        await this.waitForElementToBeHidden(this.voidConfirmDialog, 10000);
        console.log('  ✅ Clicked "Delete" — voiding label...');
    }

    /** Wait until the void finished: GET LABELS is back in place of VOID SHIPPING LABELS. */
    async waitForVoidCompleted(timeoutMs: number = 120000): Promise<void> {
        await this.waitForXenvioLoading(timeoutMs);

        // After void, the action button reverts from VOID SHIPPING LABELS to GET LABELS
        await this.getLabelsButton.waitFor({ state: 'visible', timeout: timeoutMs });

        await this.page.waitForTimeout(2000);
        console.log('✅ Void label complete — GET LABELS button restored');
    }

    /**
     * Close visible PrimeNG error toasts so they cannot cover the action bar before a retry.
     * Best effort: never throws.
     */
    async dismissErrorToasts(): Promise<void> {
        const closeButtons = this.page.locator('.p-toast-message-error')
            .locator('.p-toast-close-button, .p-toast-icon-close, button[aria-label="Close"]');
        const count = await closeButtons.count().catch(() => 0);
        for (let index = count - 1; index >= 0; index--) {
            await closeButtons.nth(index).click({ timeout: 2000 }).catch(() => undefined);
        }
    }

}
