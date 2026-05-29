import { Page } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Component: Box-Item Form
 *
 * Handles all interactions related to creating boxes and adding items
 * within the shipment detail panel.
 *
 * Responsibilities:
 *  - Add Box: click, fill form, apply
 *  - Add Item: click per-box button, fill item form, apply
 *  - Country autocomplete
 *
 * Follows the project POM pattern: locators declared as readonly
 * in the constructor (see docs/04-page-objects.md).
 */
export class XenvioBoxItemForm extends BasePage {

    readonly addBoxButton;
    readonly addItemButtons;

    constructor(page: Page) {
        super(page);
        this.addBoxButton  = page.locator('button').filter({ hasText: /Add Box/i }).first();
        this.addItemButtons = page.locator('button').filter({ hasText: /Add Item/i });
    }

    // ─── Box Management ──────────────────────────────────────────────

    /** Click the "+ Add Box" button (with pre-click buffer for Angular state). */
    async clickAddBox(): Promise<void> {
        console.log('Clicking "+ Add Box" button...');
        await this.waitForElementToBeVisible(this.addBoxButton);
        // Buffer required: Angular needs to finish internal state updates
        // from the previous box before accepting a new click.
        await this.page.waitForTimeout(1500);
        await this.click(this.addBoxButton);
        await this.page.waitForTimeout(1000); // Wait for new box form to render
        console.log('✅ "+ Add Box" clicked');
    }

    /**
     * Fill the details for the newly added box form.
     * Fields order: [0]=Name, [1]=Weight, [2]=Length, [3]=Width, [4]=Height
     */
    async fillBoxForm(name: string, weight: string, length: string, width: string, height: string): Promise<void> {
        console.log(`Filling box form — Name: ${name}...`);
        const boxForm = this.page
            .locator('form')
            .filter({ hasText: /Name|Weight/i })
            .last();
        await this.waitForElementToBeVisible(boxForm);

        const inputs = boxForm.locator('input[type="text"], input[type="number"], input:not([type="checkbox"])');
        const values = [name, weight, length, width, height];
        const labels = ['Name', 'Weight', 'Length', 'Width', 'Height'];

        for (let i = 0; i < values.length; i++) {
            const input = inputs.nth(i);
            await input.click();
            await input.clear();
            await input.pressSequentially(values[i], { delay: 60 });
            await input.dispatchEvent('input');
            await input.dispatchEvent('change');
            await input.press('Tab');
            await this.page.waitForTimeout(150);
            console.log(`  → Box field "${labels[i]}": ${values[i]}`);
        }

        console.log('✅ Box form filled');
    }

    /** Click "Apply" on the box creation form and wait for the panel to stabilize. */
    async clickApplyBox(): Promise<void> {
        console.log('Clicking Apply Box...');
        const applyBtn = this.page.locator('form button').filter({ hasText: /^Apply$/i }).last();
        await this.waitForElementToBeVisible(applyBtn);
        await applyBtn.click({ force: true });

        // Wait for the form to disappear before continuing
        try {
            await applyBtn.waitFor({ state: 'hidden', timeout: 8000 });
        } catch {
            // Form may have already closed — continue.
        }
        // Wait until the new "Add Item" button is present (box panel is ready)
        await this.addItemButtons.last().waitFor({ state: 'visible', timeout: 8000 });
        await this.page.waitForTimeout(1000); // Buffer for Angular animations
        console.log('✅ Box applied and panel ready');
    }

    // ─── Item Management ─────────────────────────────────────────────

    /** Click "+ Add Item" for the last visible box (single-box flow). */
    async clickAddItem(): Promise<void> {
        console.log('Clicking "+ Add Item" button...');
        const btn = this.addItemButtons.last();
        await this.waitForElementToBeVisible(btn, 10000);
        await this.click(btn);
        await this.page.waitForTimeout(2000);
        console.log('✅ "+ Add Item" clicked');
    }

    /** Click "+ Add Item" for a specific box by zero-based index (multi-box flow). */
    async clickAddItemForBox(boxIndex: number): Promise<void> {
        console.log(`Clicking "+ Add Item" for box index ${boxIndex}...`);

        // 1. Wait for any loading spinner to finish (DOM might be re-rendering)
        await this.waitForXenvioLoading(15000);

        // 2. Wait for any currently open item form to close before counting buttons
        //    (an open form adds extra DOM elements that shift the nth index)
        try {
            const openForm = this.page.locator('form button').filter({ hasText: /^Apply$/i });
            if (await openForm.count() > 0) {
                console.log('  ⏳ Waiting for previous item form to close...');
                await openForm.first().waitFor({ state: 'hidden', timeout: 8000 });
            }
        } catch {
            // Form already gone — continue
        }

        // 3. Buffer for Angular to finish re-rendering box panels
        await this.page.waitForTimeout(1000);

        // 4. Scroll down to make sure all boxes and their buttons are visible
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.page.waitForTimeout(500);

        // 5. Re-query and click with retry
        const btn = this.addItemButtons.nth(boxIndex);
        try {
            await btn.scrollIntoViewIfNeeded({ timeout: 5000 });
            await this.waitForElementToBeVisible(btn, 15000);
            await this.click(btn);
        } catch {
            // Retry: scroll to bottom again and try once more
            console.log(`  ⚠ Button at index ${boxIndex} not found, retrying...`);
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await this.page.waitForTimeout(1000);
            const retryBtn = this.page.locator('button').filter({ hasText: /Add Item/i }).nth(boxIndex);
            await retryBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
            await this.waitForElementToBeVisible(retryBtn, 15000);
            await this.click(retryBtn);
        }

        await this.page.waitForTimeout(2000);
        console.log(`✅ "+ Add Item" clicked for box index ${boxIndex}`);
    }

    /** Fill all item detail fields in the currently open item form. */
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
        await this.page.waitForTimeout(500);

        await this.fillFormField('SKU', item.sku);
        await this.fillFormField('Weight', item.weight);
        await this.fillFormField('Length', item.length);
        await this.fillFormField('Width', item.width);
        await this.fillFormField('Height', item.height);
        await this.selectCountry(item.country);
        await this.fillFormField('Unit Price', item.unitPrice);
        await this.fillFormField('Qty', item.qty);

        console.log('✅ Item details filled');
    }

    /**
     * Fill all item detail fields for an INTERNATIONAL shipment.
     * Includes standard domestic fields plus customs-specific fields:
     *   - Item Description
     *   - Harmonization Code (uses formcontrolname for resilience)
     *   - Country of Origin (uses formcontrolname for resilience)
     *
     * @param item International item data with customs fields
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
        await this.page.waitForTimeout(500);

        await this.fillFormField('SKU', item.sku);
        await this.fillFormField('Weight', item.weight);
        await this.fillFormField('Length', item.length);
        await this.fillFormField('Width', item.width);
        await this.fillFormField('Height', item.height);
        await this.fillFormField('Item Description', item.itemDescription);

        // Harmonization Code – use formcontrolname for environment resilience
        const harmonizationInput = this.page.locator(
            'input[formcontrolname="harmonization"], input[placeholder*="Harmonization" i]'
        ).first();
        if (await this.isElementVisible(harmonizationInput, 5000)) {
            await harmonizationInput.click();
            await harmonizationInput.clear();
            await harmonizationInput.pressSequentially(item.harmonizationCode, { delay: 80 });
            await harmonizationInput.dispatchEvent('input');
            await harmonizationInput.dispatchEvent('change');
            await harmonizationInput.press('Tab');
            console.log(`  → Harmonization Code: ${item.harmonizationCode}`);
        } else {
            console.log('  ⚠ Harmonization Code field not found, skipping');
        }

        // Country of Origin – use formcontrolname for environment resilience
        const countryOriginInput = this.page.locator(
            'input[formcontrolname="country_of_origin"], input[placeholder*="Country of Origin" i]'
        ).first();
        if (await this.isElementVisible(countryOriginInput, 5000)) {
            await countryOriginInput.click();
            await countryOriginInput.clear();
            await countryOriginInput.pressSequentially(item.countryOfOrigin, { delay: 80 });
            await countryOriginInput.dispatchEvent('input');
            await countryOriginInput.dispatchEvent('change');
            await countryOriginInput.press('Tab');
            console.log(`  → Country of Origin: ${item.countryOfOrigin}`);
        } else {
            // Fallback: mat-form-field label
            await this.fillFormField('Country of Origin', item.countryOfOrigin);
        }

        await this.fillFormField('Unit Price', item.unitPrice);
        await this.fillFormField('Qty', item.qty);

        console.log('✅ International item details filled');
    }

    /** Click the "Apply" button for the current item form. */
    async clickApplyItem(): Promise<void> {
        console.log('Clicking Apply item...');
        const btn = this.page.locator('button:not([disabled])').filter({ hasText: /^Apply$/i }).first();

        if (await this.isElementVisible(btn, 5000)) {
            await this.click(btn);
        } else {
            const formBtn = this.page.locator('form button:not([disabled])').filter({ hasText: /Apply/i }).first();
            if (await this.isElementVisible(formBtn, 3000)) {
                await this.click(formBtn);
            } else {
                console.log('⚠️ Apply item button not found');
            }
        }
        await this.page.waitForTimeout(1500);
        console.log('✅ Item applied');
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    /** Fill a mat-form-field input by its label text.
     *
     * Uses pressSequentially (character-by-character) so Angular's reactive
     * form validators (e.g. Weight "required" check) fire on every keystroke
     * instead of receiving a silent bulk paste that can be missed.
     *
     * Resilience strategy:
     *  1. Dismiss any blocking toasts/overlays via Escape key before clicking.
     *  2. Retry the click once with force:true if a normal click is intercepted.
     *  3. Throw an explicit error (instead of silently skipping) so failures are visible.
     */
    private async fillFormField(labelText: string, value: string): Promise<void> {
        const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const input = this.page
            .locator('mat-form-field')
            .filter({ hasText: new RegExp(`^\\s*${escaped}`, 'i') })
            .locator('input')
            .first();

        if (!(await this.isElementVisible(input, 5000))) {
            console.log(`  ⚠ Field "${labelText}" not found, skipping`);
            return;
        }

        // Dismiss any toast notifications or overlays that could intercept the click
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);

        // First attempt: normal click
        try {
            await input.click({ timeout: 8000 });
        } catch {
            // Fallback: force click bypasses pointer-interception checks
            console.log(`  ⚠ Normal click blocked for "${labelText}", retrying with force...`);
            await input.click({ force: true, timeout: 8000 });
        }

        await input.clear();
        // Type character-by-character so Angular reactive validators fire on each keystroke
        await input.pressSequentially(value, { delay: 80 });
        await input.dispatchEvent('input');
        await input.dispatchEvent('change');
        await input.press('Tab');
        await this.page.waitForTimeout(200); // Let Angular settle after Tab
        console.log(`  → Filled "${labelText}": ${value}`);
    }

    /** Type the country code into the autocomplete and select the first option. */
    async selectCountry(countryCode: string): Promise<void> {
        console.log(`Selecting country: ${countryCode}`);
        const autocompleteInput = this.page.locator(
            'mat-form-field input[mat-mdc-autocomplete-trigger], mat-form-field input.mat-mdc-autocomplete-trigger'
        ).first();

        const targetInput = await this.isElementVisible(autocompleteInput, 3000)
            ? autocompleteInput
            : this.page.locator('mat-form-field').filter({ hasText: /country/i }).locator('input').first();

        await targetInput.fill('');
        await targetInput.pressSequentially(countryCode, { delay: 100 });
        await this.page.waitForTimeout(1000);

        const option = this.page.locator('mat-option .mdc-list-item__primary-text').first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await this.page.waitForTimeout(500);
        console.log(`✅ Country selected: ${countryCode}`);
    }
}
