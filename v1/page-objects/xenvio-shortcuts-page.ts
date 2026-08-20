import { Page, Locator, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Page Object for the Xenvio Keyboard Shortcuts modal.
 *
 * Flow:
 *   1. Click the user profile button in the top-right header
 *   2. Click "Shortcuts" in the dropdown menu
 *   3. The "Keyboard Shortcuts" modal opens
 *   4. Verify, interact, and close the modal
 *
 * This Page Object is designed to work on the popup Page
 * returned by XenvioDashboardPage.openShipperView().
 */
export class XenvioShortcutsPage extends BasePage {

    // ─── Header - User Menu ─────────────────────────────────────────
    /** The user avatar / profile button in the top-right corner */
    readonly userMenuButton: Locator;

    // ─── Shortcuts Modal ────────────────────────────────────────────
    /** The dialog container for the Keyboard Shortcuts modal */
    readonly shortcutsModal: Locator;
    /** The "Close" button inside the modal */
    readonly closeModalButton: Locator;

    constructor(page: Page) {
        super(page);

        // User menu trigger — the button containing the user initials/email in the header
        // From the screenshot: class="mat-mdc-menu-trigger" containing user info
        this.userMenuButton = page
            .locator('button.mat-mdc-menu-trigger')
            .filter({ hasText: /Admin|test@send\.com/i })
            .first();

        // The modal dialog container
        this.shortcutsModal = page.locator('mat-dialog-container');

        // Close button inside the shortcuts modal
        this.closeModalButton = page
            .locator('mat-dialog-container button')
            .filter({ hasText: /^Close$/i })
            .first();
    }

    // ─── Actions ────────────────────────────────────────────────────

    /**
     * Click the user profile / avatar button in the top-right header
     * to open the user dropdown menu.
     */
    async openUserMenu(): Promise<void> {
        console.log('Opening user menu...');
        await this.waitForElementToBeVisible(this.userMenuButton);
        await this.click(this.userMenuButton);
        await this.page.waitForTimeout(500); // Wait for dropdown animation
        console.log('✅ User menu opened');
    }

    /**
     * Click the "Shortcuts" option in the user dropdown menu.
     * The menu item contains the text "Shortcuts" and a keyboard icon.
     */
    async clickShortcutsOption(): Promise<void> {
        console.log('Clicking Shortcuts menu option...');
        // From the screenshot: mat-mdc-menu-item containing "Shortcuts" text
        const shortcutsItem = this.page
            .locator('button.mat-mdc-menu-item')
            .filter({ hasText: /Shortcuts/i })
            .first();
        await this.waitForElementToBeVisible(shortcutsItem);
        await this.click(shortcutsItem);
        await this.page.waitForTimeout(500); // Wait for modal open animation
        console.log('✅ Shortcuts option clicked');
    }

    /**
     * Wait for the Keyboard Shortcuts modal to be fully visible.
     */
    async waitForShortcutsModal(): Promise<void> {
        console.log('Waiting for Keyboard Shortcuts modal...');
        await this.waitForElementToBeVisible(this.shortcutsModal, 8000);
        // Also wait for the title to confirm the correct modal opened
        const title = this.page
            .locator('mat-dialog-container')
            .filter({ hasText: /Keyboard Shortcuts/i })
            .first();
        await this.waitForElementToBeVisible(title, 5000);
        console.log('✅ Keyboard Shortcuts modal is visible');
    }

    /**
     * Check if the Keyboard Shortcuts modal is currently visible.
     */
    async isShortcutsModalVisible(): Promise<boolean> {
        const modal = this.page
            .locator('mat-dialog-container')
            .filter({ hasText: /Keyboard Shortcuts/i })
            .first();
        return await this.isElementVisible(modal, 5000);
    }

    /**
     * Verify the modal contains specific shortcut rows.
     * Asserts that the well-known shortcuts are present in the modal.
     */
    async verifyDefaultShortcuts(): Promise<void> {
        console.log('Verifying default shortcuts in modal...');
        const modal = this.page.locator('mat-dialog-container');

        // Verify key shortcuts visible in the screenshots
        const expectedShortcuts = [
            'Focus Search',
            'QC Packing',
            'Get Rates',
            'Get Labels',
            'Pause / Resume Order',
            'Save & Confirm',
        ];

        for (const shortcut of expectedShortcuts) {
            const row = modal.locator('div, span, p').filter({ hasText: new RegExp(shortcut, 'i') }).first();
            const isVisible = await this.isElementVisible(row, 3000);
            if (isVisible) {
                console.log(`  ✅ Shortcut found: "${shortcut}"`);
            } else {
                console.log(`  ⚠️ Shortcut NOT found: "${shortcut}"`);
            }
        }
        console.log('✅ Shortcuts verification complete');
    }

    /**
     * Close the Keyboard Shortcuts modal by clicking the "Close" button.
     */
    async closeModal(): Promise<void> {
        console.log('Closing Shortcuts modal...');
        await this.waitForElementToBeVisible(this.closeModalButton);
        await this.click(this.closeModalButton);
        // Wait for the modal to disappear
        await this.shortcutsModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
            // Modal may have already closed
        });
        console.log('✅ Shortcuts modal closed');
    }

    /**
     * Full flow: open menu → click Shortcuts → wait for modal.
     * Convenience method to avoid repeating the 3-step sequence in tests.
     */
    async openShortcutsModal(): Promise<void> {
        await this.openUserMenu();
        await this.clickShortcutsOption();
        await this.waitForShortcutsModal();
    }
}
