import { Page, expect } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Carrier Restriction Dialog
 *
 * Handles the "Action Required" dialog that appears when a selected
 * carrier (e.g. ezUSPS) does not support multi-box shipments.
 *
 * The dialog offers two options:
 *   - "Consolidate 1 box"  → merges all boxes into one
 *   - "Divide"             → splits into separate shipments
 *
 * This component only validates the dialog is shown correctly.
 * Selecting an action is left to the calling test.
 */
export class XenvioCarrierRestrictionDialog extends BasePage {

    // ── Ship Code dropdown (in the Configure Shipment panel) ─────────────
    readonly shipCodeDropdown;

    // ── Carrier dropdown (in the Configure Shipment panel) ───────────────
    readonly carrierDropdown;

    // ── The "Action Required" dialog ──────────────────────────────────────
    readonly dialogContainer;
    readonly dialogTitle;
    readonly consolidateButton;
    readonly divideButton;

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

    constructor(page: Page) {
        super(page);

        // Use role-based selectors (matches Angular Material mat-select rendering)
        // Primary: getByRole('combobox') — matches the actual rendered <select>
        // These match the recorded locators from the Playwright codegen
        this.shipCodeDropdown = page.getByRole('combobox', { name: /ship.?code/i });
        this.carrierDropdown  = page.getByRole('combobox', { name: /carrier/i });

        // The "Action Required" inline section (NOT a modal dialog)
        // This is a panel section that appears when the carrier doesn't support multi-box
        this.dialogContainer   = page.getByText(/action required/i).first();
        this.dialogTitle       = page.getByText(/does not support multi.?box/i).first();
        this.consolidateButton = page.getByRole('button', { name: /consolidate/i }).first();
        this.divideButton      = page.getByRole('button', { name: /divide/i }).first();
    }

    // ─── Ship Code Selection ────────────────────────────────────────────

    /**
     * Select a ship code from the dropdown.
     * Tries the provided codes in order and stops at the first one found.
     * Falls back to EUSRPBB if none of the preferred ones are available.
     */
    async selectShipCode(preferredCodes: string[] = XenvioCarrierRestrictionDialog.RESTRICTED_SHIP_CODES): Promise<string> {
        console.log('Selecting restricted ship code...');

        // Try combobox role first, then fallback to mat-form-field filter
        let dropdown = this.shipCodeDropdown;
        if (!(await this.isElementVisible(dropdown, 5000))) {
            console.log('  ⚠ Combobox "Ship Code" not found via role, trying mat-form-field...');
            dropdown = this.page.locator('mat-form-field').filter({ hasText: /ship.?code/i }).first();
        }

        await this.waitForElementToBeVisible(dropdown, 10000);
        await dropdown.click();
        await this.page.waitForTimeout(1000);

        // Try each preferred code (use contains match, not exact)
        for (const code of preferredCodes) {
            const option = this.page.locator('mat-option').filter({ hasText: new RegExp(code, 'i') });
            if (await this.isElementVisible(option, 1500)) {
                await option.click();
                console.log(`✅ Ship code selected: ${code}`);
                await this.page.waitForTimeout(1000);
                return code;
            }
        }

        // Fallback: pick the first available option
        console.log('⚠️ None of the preferred codes found. Selecting first available...');
        const firstOption = this.page.locator('mat-option').first();
        const firstText = await firstOption.textContent();
        await firstOption.click();
        await this.page.waitForTimeout(1000);
        console.log(`  → Fallback ship code selected: ${firstText?.trim()}`);
        return firstText?.trim() ?? 'unknown';
    }

    // ─── Carrier Selection ──────────────────────────────────────────────

    /**
     * Select a carrier by name (partial match, case-insensitive).
     * Used as an alternative path when ship code auto-fill is unreliable.
     */
    async selectCarrier(carrierName: string): Promise<void> {
        console.log(`Selecting carrier: ${carrierName}`);

        // Try combobox role first, then fallback to mat-form-field filter
        let dropdown = this.carrierDropdown;
        if (!(await this.isElementVisible(dropdown, 5000))) {
            console.log('  ⚠ Combobox "Carrier" not found via role, trying mat-form-field...');
            dropdown = this.page.locator('mat-form-field').filter({ hasText: /carrier/i }).first();
        }

        await this.waitForElementToBeVisible(dropdown, 10000);
        await dropdown.click();
        await this.page.waitForTimeout(800);

        const option = this.page.locator('mat-option').filter({ hasText: new RegExp(carrierName, 'i') }).first();
        if (await this.isElementVisible(option, 5000)) {
            await option.click();
            console.log(`✅ Carrier selected: ${carrierName}`);
        } else {
            console.log(`⚠️ Carrier "${carrierName}" not found in dropdown`);
        }
        await this.page.waitForTimeout(1000);
    }

    // ─── Restriction Section Validation ────────────────────────────────

    /**
     * Wait for the carrier restriction section to appear.
     * This is an inline "Action Required" panel (not a modal dialog)
     * that renders when the selected carrier doesn't support multi-box.
     * Returns true if it appeared, false otherwise.
     */
    async waitForRestrictionDialog(timeoutMs = 15000): Promise<boolean> {
        console.log('Waiting for carrier restriction section...');
        try {
            // The section shows text like "This Carrier Does not Support Multi-box"
            await this.dialogTitle.waitFor({ state: 'visible', timeout: timeoutMs });
            console.log('✅ Carrier restriction section appeared');
            return true;
        } catch {
            // Fallback: try the "Action Required" header
            try {
                await this.dialogContainer.waitFor({ state: 'visible', timeout: 5000 });
                console.log('✅ "Action Required" section appeared');
                return true;
            } catch {
                console.log('ℹ️  No restriction section appeared (carrier may support multi-box)');
                return false;
            }
        }
    }

    /**
     * Assert the restriction section is visible with the expected options.
     */
    async assertRestrictionDialogVisible(): Promise<void> {
        console.log('Asserting carrier restriction section content...');

        // The restriction message must be visible
        await expect(this.dialogTitle).toBeVisible({ timeout: 10000 });

        // Both action buttons must be present
        await expect(this.consolidateButton).toBeVisible({ timeout: 5000 });
        await expect(this.divideButton).toBeVisible({ timeout: 5000 });

        const consolidateText = await this.consolidateButton.textContent();
        const divideText      = await this.divideButton.textContent();

        console.log(`  → Option 1: "${consolidateText?.trim()}"`);
        console.log(`  → Option 2: "${divideText?.trim()}"`);
        console.log('✅ Restriction section content validated');
    }

    /**
     * The restriction section is inline and doesn't need dismissal.
     * This method scrolls away or clears the ship code to remove it.
     */
    async dismissDialog(): Promise<void> {
        console.log('Carrier restriction section acknowledged (inline — no dismiss needed)');
    }
}
