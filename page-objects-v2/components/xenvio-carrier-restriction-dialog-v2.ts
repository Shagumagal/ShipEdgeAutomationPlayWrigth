import { Page, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Carrier Restriction Dialog (v2 — PrimeNG)
 *
 * Handles the "Action Required" inline section that appears when a carrier
 * (e.g. ezUSPS) does not support multi-box shipments.
 *
 * In v2 the ship code dropdown is a p-select (PrimeNG), not mat-select.
 * The dialog content itself uses the same Angular Material rendering.
 */
export class XenvioCarrierRestrictionDialogV2 extends BasePage {

    // Ship codes known to trigger the multi-box restriction dialog (ezUSPS)
    static readonly RESTRICTED_SHIP_CODES = [
        'EUSRPBB',  // Regional Priority Box B
        'EUSRPBA',  // Regional Priority Box A
        'EUSFLBS',  // Flat Rate Box - Small
        'EUSFLBM',  // Flat Rate Box - Medium
        'EUSFLBLUS',// Flat Rate Large Envelope
        'EUSFLBLLC',// Flat Rate Large Container
        'EUSFLBL',  // Flat Rate Box - Large
        'EUSFLED',  // Flat Rate Padded Envelope
        'EUSFLE',   // Flat Rate Envelope
        'EUSPRIMD', // Priority Mail
        'EUSSPM',   // Priority Mail
    ];

    // The ship code p-select dropdown in the Configure Shipment panel
    readonly shipCodeDropdown;

    // The "Action Required" inline section
    readonly dialogTitle;
    readonly consolidateButton;
    readonly divideButton;

    constructor(page: Page) {
        super(page);

        // Ship Code dropdown — try p-select (PrimeNG) first, then mat-select fallback
        this.shipCodeDropdown = page.locator('p-select').filter({ hasText: /ship.?code/i }).first();

        // Restriction section content
        this.dialogTitle       = page.getByText(/does not support multi.?box/i).first();
        this.consolidateButton = page.getByRole('button', { name: /consolidate/i }).first();
        this.divideButton      = page.getByRole('button', { name: /divide/i }).first();
    }

    // ─── Ship Code Selection (PrimeNG p-select) ─────────────────────────

    /**
     * Select a restricted ship code from the p-select dropdown.
     * Tries the provided codes in order and stops at the first one found.
     */
    async selectShipCode(preferredCodes: string[] = XenvioCarrierRestrictionDialogV2.RESTRICTED_SHIP_CODES): Promise<string> {
        console.log('Selecting restricted ship code (v2 PrimeNG)...');

        // Try p-select first
        let usingPrimeNG = await this.isElementVisible(this.shipCodeDropdown, 5000);

        if (usingPrimeNG) {
            // PrimeNG p-select: click to open the overlay panel
            await this.shipCodeDropdown.click();
            await this.page.waitForTimeout(800);

            // The p-select overlay panel contains p-select-option items
            for (const code of preferredCodes) {
                const option = this.page.locator('p-select-option, li[role="option"]')
                    .filter({ hasText: new RegExp(code, 'i') }).first();

                if (await this.isElementVisible(option, 1500)) {
                    await option.click();
                    console.log(`✅ Ship code selected (p-select): ${code}`);
                    await this.page.waitForTimeout(1000);
                    return code;
                }
            }

            // Fallback: pick the first available option
            console.log('⚠️ None of the preferred codes found. Selecting first available...');
            const firstOption = this.page.locator('p-select-option, li[role="option"]').first();
            const firstText = await firstOption.textContent();
            await firstOption.click();
            await this.page.waitForTimeout(1000);
            console.log(`  → Fallback ship code selected: ${firstText?.trim()}`);
            return firstText?.trim() ?? 'unknown';

        } else {
            // mat-select fallback (legacy rendering still present)
            console.log('  ⚠ p-select not found, trying mat-select fallback...');
            const matDropdown = this.page.locator('mat-form-field').filter({ hasText: /ship.?code/i }).first();
            await this.waitForElementToBeVisible(matDropdown, 10000);
            await matDropdown.click();
            await this.page.waitForTimeout(1000);

            for (const code of preferredCodes) {
                const option = this.page.locator('mat-option').filter({ hasText: new RegExp(code, 'i') });
                if (await this.isElementVisible(option, 1500)) {
                    await option.click();
                    console.log(`✅ Ship code selected (mat-select): ${code}`);
                    await this.page.waitForTimeout(1000);
                    return code;
                }
            }

            const firstOption = this.page.locator('mat-option').first();
            const firstText = await firstOption.textContent();
            await firstOption.click();
            await this.page.waitForTimeout(1000);
            return firstText?.trim() ?? 'unknown';
        }
    }

    // ─── Restriction Section Validation ────────────────────────────────

    /**
     * Wait for the carrier restriction section to appear.
     */
    async waitForRestrictionDialog(timeoutMs = 15000): Promise<boolean> {
        console.log('Waiting for carrier restriction section...');
        try {
            await this.dialogTitle.waitFor({ state: 'visible', timeout: timeoutMs });
            console.log('✅ Carrier restriction section appeared');
            return true;
        } catch {
            // Fallback: try the "Action Required" header
            try {
                const actionRequired = this.page.getByText(/action required/i).first();
                await actionRequired.waitFor({ state: 'visible', timeout: 5000 });
                console.log('✅ "Action Required" section appeared');
                return true;
            } catch {
                console.log('ℹ️  No restriction section appeared');
                return false;
            }
        }
    }

    /**
     * Assert the restriction section is visible with the expected options.
     */
    async assertRestrictionDialogVisible(): Promise<void> {
        console.log('Asserting carrier restriction section content...');

        await expect(this.dialogTitle).toBeVisible({ timeout: 10000 });
        await expect(this.consolidateButton).toBeVisible({ timeout: 5000 });
        await expect(this.divideButton).toBeVisible({ timeout: 5000 });

        const consolidateText = await this.consolidateButton.textContent();
        const divideText      = await this.divideButton.textContent();

        console.log(`  → Option 1: "${consolidateText?.trim()}"`);
        console.log(`  → Option 2: "${divideText?.trim()}"`);
        console.log('✅ Restriction section content validated');
    }
}
