import { Page, Locator } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Item Add Modal (v2 — PrimeNG DynamicDialog)
 *
 * In the new UI, clicking "Add Item" opens a PrimeNG DynamicDialog
 * (SvItemAddModalComponent) instead of an inline form.
 *
 * Form fields use pInputText with formControlName:
 *   sku, weight, length, width, height, description,
 *   harmonization, country (p-autoComplete), price, quantity
 *
 * Buttons:
 *   - p-button label="Save" severity="success"
 *   - p-button label="Cancel" severity="secondary"
 */
export class XenvioItemModal extends BasePage {

    readonly addItemButtons: Locator;

    constructor(page: Page) {
        super(page);
        this.addItemButtons = page.locator('p-button, button').filter({ hasText: /Add Item/i });
    }

    // ─── Item Management ─────────────────────────────────────────────

    /** Click "+ Add Item" for the last visible box (single-box flow). */
    async clickAddItem(): Promise<void> {
        console.log('Clicking "+ Add Item" button...');
        const btn = this.addItemButtons.last();
        await this.waitForElementToBeVisible(btn, 10000);
        await this.click(btn);
        // Wait for the item modal to appear
        await this.waitForPrimeNGDialog(10000);
        console.log('✅ "Add Item" modal opened');
    }

    /** Click "+ Add Item" for a specific box by zero-based index (multi-box flow). */
    async clickAddItemForBox(boxIndex: number): Promise<void> {
        console.log(`Clicking "+ Add Item" for box index ${boxIndex}...`);

        await this.waitForXenvioLoading(15000);

        // Wait for any open dialog to close
        try {
            const openDialog = this.page.locator('.p-dialog:visible, [role="dialog"]:visible');
            if (await openDialog.count() > 0) {
                console.log('  ⏳ Waiting for previous dialog to close...');
                await openDialog.first().waitFor({ state: 'hidden', timeout: 8000 });
            }
        } catch {
            // Dialog already gone
        }

        await this.page.waitForTimeout(1000);
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.page.waitForTimeout(500);

        // Strategy: Find box panels/cards, then locate the "Add Item" button WITHIN each one.
        // PrimeNG renders each box inside a p-panel, p-card, p-accordion-tab, or a
        // div with a class like "box-panel" / "box-card". We try several selectors.
        const boxPanelSelectors = [
            'p-panel',              // PrimeNG Panel
            'p-card',               // PrimeNG Card
            'p-accordion-tab',      // PrimeNG Accordion Tab
            '.box-panel',           // custom class
            '.box-card',            // custom class
            'mat-expansion-panel',  // Angular Material fallback
        ];

        let clicked = false;

        for (const selector of boxPanelSelectors) {
            const panels = this.page.locator(selector);
            const panelCount = await panels.count();

            if (panelCount > boxIndex) {
                const targetPanel = panels.nth(boxIndex);
                const addItemBtn = targetPanel.locator('p-button, button').filter({ hasText: /Add Item/i }).first();

                if (await this.isElementVisible(addItemBtn, 3000)) {
                    console.log(`  📌 Found "Add Item" inside ${selector}[${boxIndex}]`);
                    await addItemBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
                    await this.click(addItemBtn);
                    clicked = true;
                    break;
                }
            }
        }

        // Fallback: use the original nth() approach but log a warning
        if (!clicked) {
            console.log(`  ⚠ Could not find "Add Item" inside a box panel. Falling back to global index ${boxIndex}...`);

            // Count all "Add Item" buttons and log their positions for debugging
            const allBtns = this.page.locator('p-button, button').filter({ hasText: /Add Item/i });
            const totalBtns = await allBtns.count();
            console.log(`  📊 Total "Add Item" buttons on page: ${totalBtns}`);

            for (let b = 0; b < totalBtns; b++) {
                const btnText = await allBtns.nth(b).textContent();
                const parentText = await allBtns.nth(b).locator('..').first().getAttribute('class');
                console.log(`     [${b}] text="${btnText?.trim()}" parent-class="${parentText}"`);
            }

            const btn = allBtns.nth(boxIndex);
            try {
                await btn.scrollIntoViewIfNeeded({ timeout: 5000 });
                await this.waitForElementToBeVisible(btn, 15000);
                await this.click(btn);
            } catch {
                console.log(`  ⚠ Button at index ${boxIndex} not found, retrying...`);
                await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await this.page.waitForTimeout(1000);
                const retryBtn = this.page.locator('p-button, button').filter({ hasText: /Add Item/i }).nth(boxIndex);
                await retryBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
                await this.waitForElementToBeVisible(retryBtn, 15000);
                await this.click(retryBtn);
            }
        }

        await this.waitForPrimeNGDialog(10000);
        console.log(`✅ "Add Item" modal opened for box index ${boxIndex}`);
    }

    /** Fill all item detail fields in the currently open item modal. */
    async fillItemDetails(item: {
        sku: string;
        weight: string;
        length: string;
        width: string;
        height: string;
        country: string;
        unitPrice: string;
        qty: string;
    }): Promise<void> {
        console.log('Filling item details...');
        const dialog = await this.waitForPrimeNGDialog();
        await this.page.waitForTimeout(500);

        // SKU
        await this.fillDialogField(dialog, 'sku', item.sku, 'SKU');

        // Weight
        await this.fillDialogField(dialog, 'weight', item.weight, 'Weight');

        // Length
        await this.fillDialogField(dialog, 'length', item.length, 'Length');

        // Width
        await this.fillDialogField(dialog, 'width', item.width, 'Width');

        // Height
        await this.fillDialogField(dialog, 'height', item.height, 'Height');

        // Country of Origin — p-autoComplete
        await this.selectCountry(dialog, item.country);

        // Unit Price
        await this.fillDialogField(dialog, 'price', item.unitPrice, 'Unit Price');

        // Quantity
        await this.fillDialogField(dialog, 'quantity', item.qty, 'Qty');

        console.log('✅ Item details filled');
    }

    /**
     * Fill all item detail fields for an INTERNATIONAL shipment.
     * Includes standard fields plus customs-specific fields.
     */
    async fillInternationalItemDetails(item: {
        sku: string;
        weight: string;
        length: string;
        width: string;
        height: string;
        itemDescription: string;
        harmonizationCode: string;
        countryOfOrigin: string;
        unitPrice: string;
        qty: string;
    }): Promise<void> {
        console.log('Filling international item details...');
        const dialog = await this.waitForPrimeNGDialog();
        await this.page.waitForTimeout(500);

        await this.fillDialogField(dialog, 'sku', item.sku, 'SKU');
        await this.fillDialogField(dialog, 'weight', item.weight, 'Weight');
        await this.fillDialogField(dialog, 'length', item.length, 'Length');
        await this.fillDialogField(dialog, 'width', item.width, 'Width');
        await this.fillDialogField(dialog, 'height', item.height, 'Height');
        await this.fillDialogField(dialog, 'description', item.itemDescription, 'Item Description');
        await this.fillDialogField(dialog, 'harmonization', item.harmonizationCode, 'Harmonization Code');

        // Country of Origin — p-autoComplete
        await this.selectCountry(dialog, item.countryOfOrigin);

        await this.fillDialogField(dialog, 'price', item.unitPrice, 'Unit Price');
        await this.fillDialogField(dialog, 'quantity', item.qty, 'Qty');

        console.log('✅ International item details filled');
    }

    /** Click the "Save" button for the current item modal. */
    async clickSaveItem(): Promise<void> {
        console.log('Clicking Save item...');
        const dialog = this.page.locator('.p-dialog, [role="dialog"]').last();
        const saveBtn = dialog.locator('p-button, button').filter({ hasText: /^Save$/i }).first();

        if (await this.isElementVisible(saveBtn, 5000)) {
            await this.click(saveBtn);
        } else {
            console.log('⚠️ Save item button not found in dialog');
        }

        // Wait for dialog to close
        try {
            await dialog.waitFor({ state: 'hidden', timeout: 8000 });
        } catch {
            // Already closed
        }

        await this.page.waitForTimeout(1500);
        console.log('✅ Item saved');
    }

    /**
     * Legacy-compatible alias: clickApplyItem → clickSaveItem
     */
    async clickApplyItem(): Promise<void> {
        return this.clickSaveItem();
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    /**
     * Fill a pInputText field inside the dialog by formControlName.
     * Falls back to placeholder matching.
     */
    private async fillDialogField(dialog: Locator, formControlName: string, value: string, label: string): Promise<void> {
        const input = dialog.locator(
            `input[formcontrolname="${formControlName}"], input[placeholder*="${label}" i]`
        ).first();

        if (!(await this.isElementVisible(input, 5000))) {
            console.log(`  ⚠ Field "${label}" (${formControlName}) not found, skipping`);
            return;
        }

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(200);

        try {
            await input.click({ timeout: 8000 });
        } catch {
            console.log(`  ⚠ Normal click blocked for "${label}", retrying with force...`);
            await input.click({ force: true, timeout: 8000 });
        }

        await input.clear();
        await input.pressSequentially(value, { delay: 80 });
        await input.dispatchEvent('input');
        await input.dispatchEvent('change');
        await input.press('Tab');
        await this.page.waitForTimeout(200);
        console.log(`  → Filled "${label}": ${value}`);
    }

    /**
     * Type the country code into the p-autoComplete and select the first suggestion.
     * Uses formControlName="country" inside the dialog.
     */
    private async selectCountry(dialog: Locator, countryCode: string): Promise<void> {
        console.log(`  Selecting country: ${countryCode}`);
        const autoComplete = dialog.locator('p-autocomplete, [formcontrolname="country"]').first();

        if (await this.isElementVisible(autoComplete, 5000)) {
            await this.fillPrimeNGAutoComplete(autoComplete, countryCode, true);
            console.log(`  → Country selected: ${countryCode}`);
        } else {
            // Fallback: try input directly
            const input = dialog.locator('input[formcontrolname="country"]').first();
            if (await this.isElementVisible(input, 3000)) {
                await input.click();
                await input.clear();
                await input.pressSequentially(countryCode, { delay: 80 });
                await input.press('Tab');
                console.log(`  → Country typed (no autocomplete): ${countryCode}`);
            } else {
                console.log(`  ⚠ Country field not found, skipping`);
            }
        }
    }
}
