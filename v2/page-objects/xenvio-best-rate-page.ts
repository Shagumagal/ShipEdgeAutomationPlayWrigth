import { Locator, Page } from '@playwright/test';
import BasePage from '../../lib/basepage';

/**
 * Page Object: XenvioBestRatePage (v2 — Angular + PrimeNG)
 *
 * Handles the Best Rate configuration flow in Configuration → Best Rate.
 *
 * Angular source: x5.angular/src/app/wizard/best-rate/
 *
 * Flow:
 *   1. Config menu gear → "Configuration" → Select location/warehouse
 *   2. Navigate to "Best Rate" step in sidebar
 *   3. Click "New Best Rate" → Fill form (name, description, transit_days, minimum_price)
 *   4. Click "Save & Continue" → Verify SUCCESS toast
 *   5. Assign shipping codes (move from "Available" to "Assigned to Best Rate")
 *   6. Click "Done" → Verify Best Rate card visible in list
 */
export class XenvioBestRatePage extends BasePage {

    // ─── Configuration Menu ──────────────────────────────────────
    readonly configMenuButton: Locator;

    // ─── Best Rate List ──────────────────────────────────────────
    readonly newBestRateButton: Locator;

    // ─── Best Rate Form Fields (formControlName) ─────────────────
    readonly nameInput: Locator;
    readonly descriptionInput: Locator;
    readonly transitDaysInput: Locator;
    readonly minimumPriceInput: Locator;

    // ─── Action Buttons ──────────────────────────────────────────
    readonly saveAndContinueButton: Locator;
    readonly doneButton: Locator;
    readonly continueButton: Locator;

    // ─── Success Toast ───────────────────────────────────────────
    readonly successToast: Locator;

    constructor(page: Page) {
        super(page);

        // Header gear icon — p-button with pi-cog
        this.configMenuButton = page.locator('p-button[ptooltip="Configuration"]').first();

        // "New Best Rate" button in the best-rate-list footer
        // Source: best-rate-list.component.html → button.wizard-btn-primary "New Best Rate"
        this.newBestRateButton = page.locator('button.wizard-btn').filter({ hasText: /New Best Rate/i }).first();

        // Best Rate form fields — formControlName from best-rate-form.component.html
        this.nameInput = page.locator('input[formcontrolname="name"]').first();
        this.descriptionInput = page.locator('input[formcontrolname="description"]').first();
        this.transitDaysInput = page.locator('input[formcontrolname="transit_days"]').first();
        this.minimumPriceInput = page.locator('input[formcontrolname="minimum_price"]').first();

        // "Save & Continue" button
        // Source: best-rate-form.component.html → button "Save & Continue" (click)="saveAndContinue()"
        this.saveAndContinueButton = page.locator('button.wizard-btn').filter({ hasText: /Save & Continue|Save \u0026 Continue/i }).first();

        // "Done" button — used in shipping method assignment step
        // Source: shipping-method-assignment.component.html → button "Done"
        this.doneButton = page.locator('button.wizard-btn').filter({ hasText: /Done/i }).first();

        // "Continue" button — used after warehouse selection
        this.continueButton = page.locator('button.wizard-btn').filter({ hasText: /Continue/i }).first();

        // Success toast — PrimeNG p-toast or generic toast with SUCCESS text
        this.successToast = page.locator('p-toast, p-messages, div').filter({ hasText: /SUCCESS|success/i }).first();
    }

    // ─── Configuration Navigation (reused from carrier flow) ─────

    /**
     * Click the gear icon to open the Configuration popover.
     */
    async clickConfigMenuButton(): Promise<void> {
        console.log('Clicking Configuration gear icon...');
        let btn = this.configMenuButton;
        if (!(await this.isElementVisible(btn, 3000))) {
            btn = this.page.locator('.pi-cog').first();
        }
        await this.waitForElementToBeVisible(btn, 10000);
        await this.click(btn);
        await this.page.waitForTimeout(800);
        console.log('✅ Configuration popover opened');
    }

    /**
     * Click "Configuration" from the popover menu.
     */
    async clickConfigurationMenuItem(): Promise<void> {
        console.log('Clicking "Configuration" menu item...');
        const configBtn = this.page.locator('button').filter({ hasText: /Configuration/i }).first();
        await this.waitForElementToBeVisible(configBtn, 10000);
        await this.click(configBtn);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Navigated to Configuration page');
    }

    /**
     * Select a warehouse/facility by clicking its mat-card.
     */
    async selectLocation(warehouseName: string): Promise<void> {
        console.log(`Selecting location: ${warehouseName}...`);
        const locationCard = this.page.locator('mat-card').filter({ hasText: new RegExp(warehouseName, 'i') }).first();
        await this.waitForElementToBeVisible(locationCard, 15000);
        await this.click(locationCard);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Location selected: ${warehouseName}`);
    }

    // ─── Navigate to Best Rate Step ──────────────────────────────

    /**
     * Click the "Best Rate" step in the sidebar navigation.
     * Source: menu-onboarding.component.html → routerLink ['/configuration', step.id]
     */
    async clickBestRateStep(): Promise<void> {
        console.log('Clicking "Best Rate" step in sidebar nav...');
        const bestRateLink = this.page.locator('a[routerlinkactive]').filter({ hasText: /Best Rate/i }).first();

        if (!(await this.isElementVisible(bestRateLink, 3000))) {
            const fallback = this.page.locator('nav a, nav li a').filter({ hasText: /Best Rate/i }).first();
            await this.waitForElementToBeVisible(fallback, 10000);
            await this.click(fallback);
        } else {
            await this.click(bestRateLink);
        }

        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Navigated to Best Rate step');
    }

    /**
     * Click "Continue" after selecting the warehouse.
     * This moves from the facility step to the next onboarding step.
     */
    async clickContinue(): Promise<void> {
        console.log('Clicking "Continue" button...');
        await this.waitForElementToBeVisible(this.continueButton, 10000);
        await this.click(this.continueButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Passed warehouse selection');
    }

    // ─── New Best Rate Form ──────────────────────────────────────

    /**
     * Click "New Best Rate" button.
     * Source: best-rate-list.component.html → button "New Best Rate"
     */
    async clickNewBestRate(): Promise<void> {
        console.log('Clicking "New Best Rate" button...');
        await this.waitForElementToBeVisible(this.newBestRateButton, 10000);
        await this.click(this.newBestRateButton);
        await this.page.waitForTimeout(1000);
        console.log('✅ New Best Rate form opened');
    }

    /**
     * Fill Best Rate form using formControlName selectors.
     * Source: best-rate-form.component.html
     */
    async fillBestRateForm(data: {
        name: string;
        description: string;
        transitDays: string;
        minimumPrice: string;
    }): Promise<void> {
        console.log('Filling Best Rate form...');

        // Name — input[formcontrolname="name"]
        await this.waitForElementToBeVisible(this.nameInput, 10000);
        await this.nameInput.fill(data.name);
        console.log(`  → Name: ${data.name}`);

        // Description — input[formcontrolname="description"]
        await this.waitForElementToBeVisible(this.descriptionInput, 5000);
        await this.descriptionInput.fill(data.description);
        console.log(`  → Description: ${data.description}`);

        // Transit Days — input[formcontrolname="transit_days"] (type="number")
        await this.waitForElementToBeVisible(this.transitDaysInput, 5000);
        await this.transitDaysInput.fill(data.transitDays);
        console.log(`  → Transit Days: ${data.transitDays}`);

        // Minimum Price — input[formcontrolname="minimum_price"] (type="text" with appDecimalInput)
        await this.waitForElementToBeVisible(this.minimumPriceInput, 5000);
        await this.minimumPriceInput.fill(data.minimumPrice);
        console.log(`  → Minimum Price: ${data.minimumPrice}`);

        console.log('✅ Best Rate form filled successfully');
    }

    // ─── Save & Continue ─────────────────────────────────────────

    /**
     * Click "Save & Continue" to save the Best Rate and move to shipping method assignment.
     * Source: best-rate-form.component.html → button "Save & Continue"
     */
    async clickSaveAndContinue(): Promise<void> {
        console.log('Clicking "Save & Continue"...');
        await this.waitForElementToBeVisible(this.saveAndContinueButton, 10000);
        await this.click(this.saveAndContinueButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(30000);
        await this.page.waitForTimeout(2000);
        console.log('✅ Best Rate saved');
    }

    /**
     * Verify the SUCCESS toast appeared after saving.
     */
    async verifySuccessToast(): Promise<boolean> {
        console.log('Verifying SUCCESS toast message...');
        const isVisible = await this.isElementVisible(this.successToast, 10000);
        if (isVisible) {
            console.log('✅ SUCCESS toast confirmed');
        } else {
            console.log('⚠ SUCCESS toast NOT found within timeout');
        }
        return isVisible;
    }

    // ─── Shipping Method Assignment ──────────────────────────────

    /**
     * Assign a shipping code by clicking the arrow button (→) that moves it
     * from "Available Shipping Methods" to "Assigned to Best Rate".
     *
     * Source: shipping-method-list.component.html
     *   Left panel (mode='left'): button with [attr.aria-label]="'Select ' + item.shipping_method?.name"
     *   The arrow (→) is on the right side of each row in the left (available) table.
     *
     * @param shippingMethodName The shipping method name (e.g. "Flat Rate Box - Medium")
     * @param occurrence Which occurrence (0-based, default 0)
     */
    async assignShippingCode(shippingMethodName: string, occurrence = 0): Promise<void> {
        console.log(`Assigning shipping code: "${shippingMethodName}" (occurrence: ${occurrence})...`);
        const button = this.page.getByRole('button', { name: `Select ${shippingMethodName}` }).nth(occurrence);
        await this.waitForElementToBeVisible(button, 10000);
        await button.scrollIntoViewIfNeeded();
        await this.click(button);
        await this.page.waitForTimeout(500);
        console.log(`✅ Shipping code assigned: "${shippingMethodName}"`);
    }

    /**
     * Verify that a shipping code is in the assigned (right-hand) panel.
     * Source: shipping-method-list.component.html → table cells with client_code
     *
     * @param code The shipping code text (e.g. "EUSFRBD", "EUSEM", "EUSALP")
     */
    async isShippingCodeAssigned(code: string): Promise<boolean> {
        console.log(`Verifying shipping code is assigned: "${code}"...`);
        // The assigned list uses td elements with client_code text
        const cell = this.page.getByRole('cell', { name: code }).first();
        const visible = await this.isElementVisible(cell, 8000);
        console.log(visible
            ? `✅ Shipping code "${code}" found in assigned list`
            : `⚠ Shipping code "${code}" NOT found in assigned list`
        );
        return visible;
    }

    // ─── Done Button ─────────────────────────────────────────────

    /**
     * Click "Done" button.
     * Source: shipping-method-assignment.component.html → button "Done"
     */
    async clickDone(): Promise<void> {
        console.log('Clicking "Done" button...');
        await this.waitForElementToBeVisible(this.doneButton, 10000);
        await this.click(this.doneButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ "Done" clicked');
    }

    // ─── Best Rate Card Verification ─────────────────────────────

    /**
     * Check if the Best Rate card is visible in the "Choose Best Rate" list.
     * Source: best-rate-list.component.html → mat-card with bestRate.name
     */
    async isBestRateCardVisible(bestRateName: string): Promise<boolean> {
        const card = this.page.locator('mat-card').filter({ hasText: new RegExp(bestRateName, 'i') }).first();
        return this.isElementVisible(card, 10000);
    }

    // ─── Static Helpers ──────────────────────────────────────────

    /**
     * Generate a unique Best Rate name with a timestamp suffix and worker index.
     * Example: "Best Rate QA 2026-05-28_16h45m32s_W0"
     */
    static generateBestRateName(prefix = 'Best Rate QA', workerIndex?: number): string {
        const now = new Date();
        const timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-') + '_' +
        String(now.getHours()).padStart(2, '0') + 'h' +
        String(now.getMinutes()).padStart(2, '0') + 'm' +
        String(now.getSeconds()).padStart(2, '0') + 's';

        const suffix = workerIndex !== undefined ? `_W${workerIndex}` : '';
        return `${prefix} ${timestamp}${suffix}`;
    }
}
