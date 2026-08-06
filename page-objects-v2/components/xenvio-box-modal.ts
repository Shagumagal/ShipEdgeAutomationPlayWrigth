import { Page, Locator } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Box Add Modal (v2 — PrimeNG DynamicDialog)
 *
 * In the new UI, clicking "Add Box" opens a PrimeNG DynamicDialog
 * (SvBoxAddModalComponent) instead of an inline form.
 *
 * Form fields:
 *   - Name: p-autoComplete (formControlName="name")
 *   - Weight: input[pInputText] (formControlName="boxWeight")
 *   - Length: input[pInputText] (formControlName="length")
 *   - Width: input[pInputText] (formControlName="width")
 *   - Height: input[pInputText] (formControlName="height")
 *
 * Buttons:
 *   - p-button label="Save" severity="success"
 *   - p-button label="Cancel" severity="secondary"
 */
export class XenvioBoxModal extends BasePage {

    readonly addBoxButton: Locator;
    readonly addItemButtons: Locator;

    constructor(page: Page) {
        super(page);
        // "Add Box" is now a p-button with icon pi-plus
        this.addBoxButton = page.locator('p-button, button').filter({ hasText: /Add Box/i }).first();
        this.addItemButtons = page.locator('p-button, button').filter({ hasText: /Add Item/i });
    }

    // ─── Box Management ──────────────────────────────────────────────

    /** Click the "Add Box" button to open the DynamicDialog modal. */
    async clickAddBox(): Promise<void> {
        console.log('Clicking "Add Box" button...');
        await this.waitForElementToBeVisible(this.addBoxButton);
        await this.page.waitForTimeout(1500);
        await this.click(this.addBoxButton);
        // Wait for the dialog to appear
        await this.waitForPrimeNGDialog(10000);
        console.log('✅ "Add Box" modal opened');
    }

    /**
     * Fill the box form inside the DynamicDialog.
     * Uses formControlName attributes for reliable targeting.
     */
    async fillBoxForm(name: string, weight: string, length: string, width: string, height: string): Promise<void> {
        console.log(`Filling box form — Name: ${name}...`);
        const dialog = await this.waitForPrimeNGDialog();

        // Name field is p-autoComplete — type the name without selecting a suggestion
        const nameAutoComplete = dialog.locator('p-autocomplete, [formcontrolname="name"]').first();
        await this.fillPrimeNGAutoComplete(nameAutoComplete, name, false);
        console.log(`  → Name: ${name}`);

        // Weight field
        const weightInput = dialog.locator('input[formcontrolname="boxWeight"], input[placeholder*="Weight"]').first();
        await this.fillInputField(weightInput, weight);
        console.log(`  → Weight: ${weight}`);

        // Length field
        const lengthInput = dialog.locator('input[formcontrolname="length"], input[placeholder="L"]').first();
        await this.fillInputField(lengthInput, length);
        console.log(`  → Length: ${length}`);

        // Width field
        const widthInput = dialog.locator('input[formcontrolname="width"], input[placeholder="W"]').first();
        await this.fillInputField(widthInput, width);
        console.log(`  → Width: ${width}`);

        // Height field
        const heightInput = dialog.locator('input[formcontrolname="height"], input[placeholder="H"]').first();
        await this.fillInputField(heightInput, height);
        console.log(`  → Height: ${height}`);

        console.log('✅ Box form filled');
    }

    /** Click "Save" on the box modal to create the box. */
    async clickSaveBox(): Promise<void> {
        console.log('Clicking Save box...');
        const dialog = this.page.locator('.p-dialog, [role="dialog"]').last();
        const saveBtn = dialog.locator('p-button, button').filter({ hasText: /^Save$/i }).first();
        await this.waitForElementToBeVisible(saveBtn);
        await this.click(saveBtn);

        // Wait for modal to close
        try {
            await dialog.waitFor({ state: 'hidden', timeout: 8000 });
        } catch {
            // Modal may have already closed
        }

        // Wait for the Add Item button to appear (box panel is ready)
        await this.addItemButtons.last().waitFor({ state: 'visible', timeout: 8000 });
        await this.page.waitForTimeout(1000);
        console.log('✅ Box saved and panel ready');
    }

    /**
     * Legacy-compatible alias: clickApplyBox → clickSaveBox
     * Maintains the same interface as the old XenvioBoxItemForm
     */
    async clickApplyBox(): Promise<void> {
        return this.clickSaveBox();
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    /** Fill a pInputText field with character-by-character typing for Angular reactive forms. */
    private async fillInputField(input: Locator, value: string): Promise<void> {
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 60 });
        await input.dispatchEvent('input');
        await input.dispatchEvent('change');
        await input.press('Tab');
        await this.page.waitForTimeout(150);
    }
}
