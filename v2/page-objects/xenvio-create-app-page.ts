import { Locator, Page } from '@playwright/test';
import BasePage from '../../lib/basepage';

/**
 * Page Object: XenvioCreateAppPage (v2 — Angular + PrimeNG)
 *
 * Handles the App creation flow in Shipper View header → Apps.
 *
 * Angular source: x5.angular/src/app/apps/
 *   - apps-list.component.html → p-table with apps, "New app" button
 *   - apps-form.component.html → modal with name, warehouse checkboxes, URL inputs
 *
 * Flow:
 *   1. Click "Products" grid icon in header → Click "Apps" (or direct nav)
 *   2. Click "New app" → modal opens
 *   3. Fill Name
 *   4. Check warehouse checkbox → URL/Headers fields expand
 *   5. Fill URL
 *   6. Click "Create App"
 *   7. Verify in table by filtering by name
 */
export class XenvioCreateAppPage extends BasePage {

    // ─── Apps List ───────────────────────────────────────────────
    readonly newAppButton: Locator;

    // ─── Modal Form ──────────────────────────────────────────────
    readonly appNameInput: Locator;
    readonly createAppButton: Locator;

    // ─── Name filter in p-table ──────────────────────────────────
    readonly nameFilterInput: Locator;

    constructor(page: Page) {
        super(page);

        // "New app" button — Source: apps-list.component.html → button with "New app" text
        this.newAppButton = page.locator('button').filter({ hasText: /New app/i }).first();

        // App Name input — Source: apps-form.component.html → input#appName formControlName="name"
        this.appNameInput = page.locator('input#appName, input[formcontrolname="name"]').first();

        // "Create App" button — Source: apps-form.component.html → button (click)="onSave()"
        this.createAppButton = page.locator('button').filter({ hasText: /Create App/i }).first();

        // Name filter input in the p-table header — Source: apps-list.component.html
        // input with placeholder="Filter by name" and aria-label="Filter Name"
        this.nameFilterInput = page.locator('input[aria-label="Filter Name"], input[placeholder="Filter by name"]').first();
    }

    // ─── Navigation to Apps ──────────────────────────────────────

    /**
     * Open the Configuration gear popover and click "Apps".
     * The Apps item may be in the config popover or accessed via
     * the Products grid icon → "Apps" link in the header.
     */
    async navigateToApps(): Promise<void> {
        console.log('Navigating to Apps...');

        // Strategy 1: Click the gear icon → look for "Apps" button in popover
        const gearBtn = this.page.locator('p-button[ptooltip="Configuration"]').first();
        const gearFallback = this.page.locator('.pi-cog').first();
        const btn = (await this.isElementVisible(gearBtn, 3000)) ? gearBtn : gearFallback;

        if (await this.isElementVisible(btn, 3000)) {
            await this.click(btn);
            await this.page.waitForTimeout(800);

            const appsItem = this.page.locator('button').filter({ hasText: /Apps/i }).first();
            if (await this.isElementVisible(appsItem, 3000)) {
                await this.click(appsItem);
                await this.page.waitForLoadState('networkidle');
                await this.waitForXenvioLoading(15000);
                await this.page.waitForTimeout(1000);
                console.log('✅ Navigated to Apps via Configuration menu');
                return;
            }
        }

        // Strategy 2: Direct nav link or Products popover
        const productsBtn = this.page.locator('p-button[ptooltip="Products"]').first();
        if (await this.isElementVisible(productsBtn, 3000)) {
            await this.click(productsBtn);
            await this.page.waitForTimeout(800);
        }

        // Look for an "Apps" link/button anywhere
        const appsLink = this.page.locator('a, button').filter({ hasText: /^Apps$/i }).first();
        if (await this.isElementVisible(appsLink, 3000)) {
            await this.click(appsLink);
            await this.page.waitForLoadState('networkidle');
            await this.waitForXenvioLoading(15000);
            await this.page.waitForTimeout(1000);
            console.log('✅ Navigated to Apps');
            return;
        }

        throw new Error('Could not navigate to Apps — neither Configuration nor Products menu had an "Apps" option');
    }

    // ─── New App Modal ───────────────────────────────────────────

    /**
     * Click the "New app" button to open the modal.
     * Source: apps-list.component.html → button (click)="openModal()"
     */
    async clickNewApp(): Promise<void> {
        console.log('Clicking "New app" button...');
        await this.waitForElementToBeVisible(this.newAppButton, 10000);
        await this.click(this.newAppButton);
        await this.page.waitForTimeout(1000);
        console.log('✅ New App modal opened');
    }

    /**
     * Fill the App Name in the modal form.
     * Source: apps-form.component.html → input#appName formControlName="name"
     */
    async fillAppName(name: string): Promise<void> {
        console.log(`Filling App Name: "${name}"...`);
        await this.waitForElementToBeVisible(this.appNameInput, 10000);
        await this.appNameInput.fill(name);
        console.log(`  → App Name filled: "${name}"`);
    }

    /**
     * Check the warehouse checkbox by its label text.
     * Source: apps-form.component.html →
     *   <input type="checkbox" [id]="'wh-' + warehouse.id" />
     *   <label [for]="'wh-' + warehouse.id">{{ warehouse.name }}</label>
     *
     * After checking, the URL and Headers fields expand.
     *
     * @param warehouseName e.g. "qa20"
     */
    async selectWarehouseCheckbox(warehouseName: string): Promise<void> {
        console.log(`Selecting warehouse checkbox: "${warehouseName}"...`);

        // Find the label with the warehouse name, then locate its sibling checkbox
        const label = this.page.locator('label').filter({ hasText: new RegExp(`^\\s*${warehouseName}\\s*$`, 'i') }).first();
        await this.waitForElementToBeVisible(label, 10000);
        await label.scrollIntoViewIfNeeded();

        // Get the 'for' attribute to find the associated checkbox
        const forAttr = await label.getAttribute('for');
        let checkbox: Locator;

        if (forAttr) {
            checkbox = this.page.locator(`#${forAttr}`);
        } else {
            // Fallback: find checkbox as sibling within the same parent div
            checkbox = label.locator('..').locator('input[type="checkbox"]').first();
        }

        // Only click if not already checked
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
            await checkbox.click();
            await this.page.waitForTimeout(500);
            console.log(`  → Checkbox for "${warehouseName}" checked`);
        } else {
            console.log(`  → Checkbox for "${warehouseName}" already checked`);
        }
    }

    /**
     * Fill the URL field for a specific warehouse.
     * Source: apps-form.component.html →
     *   <input pInputText [id]="'url-' + warehouse.id" placeholder="https://example.com/api" />
     *
     * The URL input is only visible AFTER the warehouse checkbox is checked.
     *
     * @param warehouseName e.g. "qa20" — used to find the correct label/checkbox pair
     * @param url The webhook URL to fill
     */
    async fillWarehouseUrl(warehouseName: string, url: string): Promise<void> {
        console.log(`Filling URL for "${warehouseName}": ${url}...`);

        // Find the label for this warehouse to get the warehouse ID
        const label = this.page.locator('label').filter({ hasText: new RegExp(`^\\s*${warehouseName}\\s*$`, 'i') }).first();
        const forAttr = await label.getAttribute('for');

        let urlInput: Locator;

        if (forAttr) {
            // forAttr = "wh-141" → urlId = "url-141"
            const warehouseId = forAttr.replace('wh-', '');
            urlInput = this.page.locator(`#url-${warehouseId}`);
        } else {
            // Fallback: find URL input near the checkbox using placeholder
            urlInput = this.page.locator('input[placeholder="https://example.com/api"]').first();
        }

        await this.waitForElementToBeVisible(urlInput, 5000);
        await urlInput.fill(url);
        console.log(`  → URL filled for "${warehouseName}"`);
    }

    /**
     * Click the "Create App" button.
     * Source: apps-form.component.html → button (click)="onSave()" "Create App"
     */
    async clickCreateApp(): Promise<void> {
        console.log('Clicking "Create App" button...');
        await this.waitForElementToBeVisible(this.createAppButton, 10000);
        await this.click(this.createAppButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(2000);
        console.log('✅ App creation submitted');
    }

    // ─── Verification ────────────────────────────────────────────

    /**
     * Filter the apps table by name and check if the app appears.
     * Source: apps-list.component.html → input[aria-label="Filter Name"]
     */
    async filterAndVerifyApp(appName: string): Promise<boolean> {
        console.log(`Filtering apps table by name: "${appName}"...`);

        await this.waitForElementToBeVisible(this.nameFilterInput, 10000);
        await this.nameFilterInput.fill(appName);
        await this.page.waitForTimeout(1500); // wait for Angular filter to apply

        // Look for the app name in the table body
        const cell = this.page.locator('td span').filter({ hasText: new RegExp(appName, 'i') }).first();
        const isVisible = await this.isElementVisible(cell, 8000);

        if (isVisible) {
            console.log(`✅ App "${appName}" found in table`);
        } else {
            console.log(`⚠ App "${appName}" NOT found in table`);
        }

        return isVisible;
    }

    /**
     * Check if the modal is visible (role="dialog" or the backdrop with the form).
     */
    async isNewAppModalVisible(): Promise<boolean> {
        const modal = this.page.locator('[role="dialog"], div.fixed.inset-0').first();
        return this.isElementVisible(modal, 5000);
    }

    // ─── Static Helpers ──────────────────────────────────────────

    /**
     * Generate a short, unique app name using the warehouse prefix.
     * Example: "qa20-app-14h23"
     */
    static generateAppName(warehouse: string): string {
        const now = new Date();
        const timeSuffix = String(now.getHours()).padStart(2, '0') + 'h' +
            String(now.getMinutes()).padStart(2, '0');
        return `${warehouse}-app-${timeSuffix}`;
    }

    /**
     * Build the webhook URL from the warehouse name.
     * Example: "https://qa20.shipedge.com/apirest/webhooks/xenvio/shipments"
     */
    static buildWebhookUrl(warehouse: string): string {
        return `https://${warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments`;
    }
}
