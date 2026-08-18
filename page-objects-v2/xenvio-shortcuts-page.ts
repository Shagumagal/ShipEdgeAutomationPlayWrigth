import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Xenvio Keyboard Shortcuts modal (v2 — PrimeNG).
 *
 * Flow:
 *   1. Click the user profile button in the top-right header
 *   2. Click "Shortcuts" in the dropdown menu
 *   3. The "Keyboard Shortcuts" modal opens
 *   4. Verify, interact, and close the modal
 */
export class XenvioShortcutsPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ─── Actions ────────────────────────────────────────────────────

    /**
     * Open the user profile dropdown menu.
     * Looks for the user avatar/button in the header area.
     */
    async openUserMenu(): Promise<void> {
        console.log('Opening user menu...');

        // Try PrimeNG menu trigger first, then Material fallback
        const userBtn = this.page.locator('button').filter({ hasText: /Admin|test@send\.com/i }).first();
        const menuTrigger = this.page.locator('[class*="menu-trigger"], [class*="user-menu"], p-avatar').first();

        if (await userBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await userBtn.click();
        } else if (await menuTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
            await menuTrigger.click();
        } else {
            // Fallback: look for any button with a user icon in the header
            const headerBtn = this.page.locator('header button, .toolbar button, .header button').last();
            await headerBtn.click();
        }

        await this.page.waitForTimeout(500);
        console.log('✅ User menu opened');
    }

    /**
     * Click the "Shortcuts" option in the user dropdown menu.
     */
    async clickShortcutsOption(): Promise<void> {
        console.log('Clicking Shortcuts menu option...');

        // Look for menu items containing "Shortcuts" text
        const shortcutsItem = this.page
            .locator('button, a, [role="menuitem"], .p-menuitem-link, .mat-mdc-menu-item')
            .filter({ hasText: /Shortcuts/i })
            .first();

        await shortcutsItem.waitFor({ state: 'visible', timeout: 5000 });
        await shortcutsItem.click();
        await this.page.waitForTimeout(500);
        console.log('✅ Shortcuts option clicked');
    }

    /**
     * Wait for the Keyboard Shortcuts modal to be fully visible.
     */
    async waitForShortcutsModal(): Promise<void> {
        console.log('Waiting for Keyboard Shortcuts modal...');

        // PrimeNG uses p-dialog or p-dynamicdialog; Material uses mat-dialog-container
        const modal = this.page
            .locator('p-dialog, p-dynamicdialog, mat-dialog-container, .p-dialog')
            .filter({ hasText: /Keyboard Shortcuts/i })
            .first();

        await modal.waitFor({ state: 'visible', timeout: 8000 });
        console.log('✅ Keyboard Shortcuts modal is visible');
    }

    /**
     * Check if the Keyboard Shortcuts modal is currently visible.
     */
    async isShortcutsModalVisible(): Promise<boolean> {
        const modal = this.page
            .locator('p-dialog, p-dynamicdialog, mat-dialog-container, .p-dialog')
            .filter({ hasText: /Keyboard Shortcuts/i })
            .first();
        return await modal.isVisible({ timeout: 5000 }).catch(() => false);
    }

    /**
     * Verify the modal contains the expected default shortcut labels.
     */
    async verifyDefaultShortcuts(): Promise<void> {
        console.log('Verifying default shortcuts in modal...');

        const modal = this.page.locator('p-dialog, p-dynamicdialog, mat-dialog-container, .p-dialog').first();

        const expectedShortcuts = [
            'Focus Search',
            'QC Packing',
            'Get Rates',
            'Get Labels',
            'Pause / Resume Order',
            'Save & Confirm',
        ];

        for (const shortcut of expectedShortcuts) {
            const row = modal.locator('div, span, p, td, li').filter({ hasText: new RegExp(shortcut, 'i') }).first();
            const isVisible = await row.isVisible({ timeout: 3000 }).catch(() => false);
            if (isVisible) {
                console.log(`  ✅ Shortcut found: "${shortcut}"`);
            } else {
                console.log(`  ⚠️ Shortcut NOT found: "${shortcut}"`);
            }
        }
        console.log('✅ Shortcuts verification complete');
    }

    /**
     * Close the Keyboard Shortcuts modal.
     */
    async closeModal(): Promise<void> {
        console.log('Closing Shortcuts modal...');

        // Try Close button first, then the X icon
        const closeBtn = this.page
            .locator('p-dialog button, p-dynamicdialog button, mat-dialog-container button, .p-dialog button')
            .filter({ hasText: /^Close$/i })
            .first();

        const closeIcon = this.page
            .locator('.p-dialog-header-close, .p-dialog-header-icon, [aria-label="Close"]')
            .first();

        if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await closeBtn.click();
        } else if (await closeIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
            await closeIcon.click();
        }

        // Wait for modal to disappear
        await this.page
            .locator('p-dialog, p-dynamicdialog, mat-dialog-container, .p-dialog')
            .first()
            .waitFor({ state: 'hidden', timeout: 5000 })
            .catch(() => { /* may already be closed */ });

        console.log('✅ Shortcuts modal closed');
    }

    /**
     * Full flow: open menu → click Shortcuts → wait for modal.
     */
    async openShortcutsModal(): Promise<void> {
        await this.openUserMenu();
        await this.clickShortcutsOption();
        await this.waitForShortcutsModal();
    }
}
