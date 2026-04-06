import { Page, expect } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Page Object for the Xenvio Order to Label flow.
 *
 * Flow: Shipper View (search shipment) → Shipment detail → Get Rates
 *   1. Fill package dimensions & country
 *   2. Click "Get Rates" to fetch available carriers
 *   3. Browse & select a rate
 *   4. Optionally set hazmat code
 *   5. Confirm (green) or reject (red) the selected rate
 *
 * Data captured: Order details, Shipment details, Selected rate
 */
export class XenvioOrderToLabelPage extends BasePage {

    constructor(page: Page) {
        super(page);
    }

    // ─── Navigation ─────────────────────────────────────────────────

    /** Click on a shipment row in the shipper-view results table. */
    async clickShipmentRow(shipmentId: string): Promise<void> {
        console.log(`Clicking on shipment: ${shipmentId}`);
        const row = this.page.locator(`td, span, a`).filter({ hasText: shipmentId }).first();
        await this.waitForElementToBeVisible(row);
        await this.click(row);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log(`✅ Shipment ${shipmentId} opened`);
    }

    /** Expand the shipment details panel (mat-expansion-panel-header) if it's closed. */
    async expandShipmentPanel(shipmentId?: string): Promise<void> {
        console.log(`Expanding shipment panel...`);
        // Try finding by shipmentId or fallback to the general "Ship:" keyword
        const header = shipmentId
            ? this.page.locator('mat-expansion-panel-header').filter({ hasText: new RegExp(shipmentId, 'i') }).first()
            : this.page.locator('mat-expansion-panel-header').filter({ hasText: /Ship:/i }).first();

        if (await this.isElementVisible(header, 5000)) {
            // Check if already expanded via aria-expanded attribute
            const isExpanded = await header.getAttribute('aria-expanded');
            if (isExpanded !== 'true') {
                await this.click(header);
                await this.page.waitForTimeout(1000);
                console.log(`✅ Shipment panel expanded`);
            } else {
                console.log(`✅ Shipment panel is already expanded`);
            }
        } else {
            // Last resort: click any mat-expansion-panel-header in the shipping container area
            const fallback = this.page.locator('.shipment-container mat-expansion-panel-header, mat-expansion-panel-header').first();
            if (await this.isElementVisible(fallback, 3000)) {
                await this.click(fallback);
                await this.page.waitForTimeout(1000);
                console.log(`✅ Shipment panel expanded (fallback)`);
            } else {
                console.log(`⚠️ Could not find shipment panel to expand`);
            }
        }
    }

    // ─── Package & Items ────────────────────────────────────────────

    /** Click the "+ Add Item" button inside the shipment panel (targets the last visible). */
    async clickAddItem(): Promise<void> {
        console.log('Clicking "+ Add Item" button...');
        const addItemBtn = this.page.locator('button').filter({ hasText: /Add Item/i }).last();
        await this.waitForElementToBeVisible(addItemBtn, 10000);
        await this.click(addItemBtn);
        await this.page.waitForTimeout(2000);
        console.log('✅ "+ Add Item" clicked');
    }

    /** Click the "+ Add Item" button for a specific box by index (0-based). */
    async clickAddItemForBox(boxIndex: number): Promise<void> {
        console.log(`Clicking "+ Add Item" for box index ${boxIndex}...`);
        const addItemButtons = this.page.locator('button').filter({ hasText: /Add Item/i });
        const btn = addItemButtons.nth(boxIndex);
        await this.waitForElementToBeVisible(btn, 10000);
        await this.click(btn);
        await this.page.waitForTimeout(2000);
        console.log(`✅ "+ Add Item" clicked for box index ${boxIndex}`);
    }

    // ─── Box Management ──────────────────────────────────────────────

    /** Click the "+ Add Box" button. */
    async clickAddBox(): Promise<void> {
        console.log('Clicking "+ Add Box" button...');
        const addBoxBtn = this.page.locator('button').filter({ hasText: /Add Box/i }).first();
        await this.waitForElementToBeVisible(addBoxBtn);
        // Wait for Angular to finish internal state updates from the previous box before clicking
        await this.page.waitForTimeout(1500);
        await this.click(addBoxBtn);
        await this.page.waitForTimeout(1000); // Wait for the box form to render
        console.log('✅ "+ Add Box" clicked');
    }

    /** Fill the details for a newly added box. */
    async fillBoxForm(name: string, weight: string, length: string, width: string, height: string): Promise<void> {
        console.log(`Filling box form with Name: ${name}...`);
        
        // Find the active box form. Since the form might dynamically append, we use the last visible form that has these inputs.
        const boxForm = this.page.locator('form').filter({ hasText: /Name|Weight/i }).last();
        await this.waitForElementToBeVisible(boxForm);

        // Find all text inputs in this specific form
        const inputs = boxForm.locator('input[type="text"], input[type="number"], input:not([type="checkbox"])');
        
        // Usually: [0] = Name, [1] = Weight, [2] = Length, [3] = Width, [4] = Height
        await inputs.nth(0).fill(name);
        await inputs.nth(1).fill(weight);
        await inputs.nth(2).fill(length);
        await inputs.nth(3).fill(width);
        await inputs.nth(4).fill(height);

        console.log(`✅ Box form filled`);
    }

    /** Click "Apply" on the box creation form. */
    async clickApplyBox(): Promise<void> {
        console.log('Clicking Apply Box...');
        const applyBtn = this.page.locator('form button').filter({ hasText: /^Apply$/i }).last();
        await this.waitForElementToBeVisible(applyBtn);
        await applyBtn.click({ force: true });

        // Wait for the box creation form to disappear (confirming Angular processed the new box)
        try {
            await applyBtn.waitFor({ state: 'hidden', timeout: 8000 });
        } catch {
            // Form may have already closed — continue.
        }
        // Wait for the new box panel + "Add Item" button to be present before proceeding
        await this.page.locator('button').filter({ hasText: /Add Item/i }).last().waitFor({ state: 'visible', timeout: 8000 });
        // Extra buffer for Angular animations to fully settle
        await this.page.waitForTimeout(1000);
        console.log('✅ Box applied and panel ready');
    }

    /** Fill the exact Item details in the form. */
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

    /** Fill a generic mat-form-field input by its label. */
    private async fillFormField(labelText: string, value: string): Promise<void> {
        // Escapa posibles caracteres especiales del label
        const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const input = this.page
            .locator('mat-form-field')
            .filter({ hasText: new RegExp(`^\\s*${escaped}`, 'i') })
            .locator('input')
            .first();

        if (await this.isElementVisible(input, 3000)) {
            await input.click();
            await input.fill(value);
            await input.dispatchEvent('input');
            await input.dispatchEvent('change');
            await input.press('Tab');
            console.log(`  → Filled "${labelText}": ${value}`);
        } else {
            console.log(`  ⚠ Field "${labelText}" not found, skipping`);
        }
    }

    /** Select country from the autocomplete dropdown. */
    async selectCountry(countryCode: string): Promise<void> {
        console.log(`Selecting country: ${countryCode}`);
        const countryInput = this.page
            .locator('mat-form-field input[mat-mdc-autocomplete-trigger], mat-form-field input.mat-mdc-autocomplete-trigger')
            .first();

        if (!(await this.isElementVisible(countryInput, 3000))) {
            const fallback = this.page.locator('mat-form-field').filter({ hasText: /country/i }).locator('input').first();
            await this.waitForElementToBeVisible(fallback);
            await fallback.fill('');
            await fallback.pressSequentially(countryCode, { delay: 100 });
        } else {
            await countryInput.fill('');
            await countryInput.pressSequentially(countryCode, { delay: 100 });
        }

        await this.page.waitForTimeout(1000);
        const option = this.page.locator('mat-option .mdc-list-item__primary-text').first(); // FIXED: .first() ensures US is picked, .last() picked RU
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await this.page.waitForTimeout(500);
        console.log(`✅ Country selected: ${countryCode}`);
    }

    /** Click the "Apply" / "Save" button for the new item. */
    async clickApplyItem(): Promise<void> {
        console.log('Clicking Apply item (green button)...');
        // Use exact "Apply" text to avoid matching "SAVE & CONFIRM" in the action bar.
        const btn = this.page.locator('button:not([disabled])').filter({ hasText: /^Apply$/i }).first();
        
        if (await this.isElementVisible(btn, 5000)) {
            await this.click(btn);
        } else {
            // If exact "Apply" not found, try the form-scoped Apply button
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

    /** Click "QC Packing", process the products in the modal, and confirm. */
    async processQCPacking(): Promise<void> {
        console.log('Initiating QC Packing...');
        // Espera a que la tarjeta termine de cargar antes de buscar el botón
        await this.page.waitForTimeout(1000); 
        
        const qcBtn = this.page.locator('button').filter({ hasText: /QC Packing/i }).first();
        await this.waitForElementToBeVisible(qcBtn);
        await this.click(qcBtn);
        await this.page.waitForTimeout(1000); // Wait for modal to load

        console.log('Processing items in QC Packing modal...');
        // Angular dejas "cadáveres" de modales ocultos en el DOM. Seleccionamos SOLAMENTE el visible.
        const activeModal = this.page.locator('mat-dialog-container:visible').first();
        await activeModal.waitFor({ state: 'visible', timeout: 5000 });

        // Buscamos solo los botones dentro de ese modal visible de forma explícita
        const processButtonLocator = activeModal.locator('button[aria-label^="Process item"]:visible, button[aria-label^="Process item"]');
        
        let processCount = await processButtonLocator.count();
        while (processCount > 0) {
            // Evaluamos nuevamente para asegurar que sigue visible
            const firstBtn = processButtonLocator.first();
            await firstBtn.waitFor({ state: 'visible', timeout: 3000 });
            await firstBtn.click({ force: true });
            
            await this.page.waitForTimeout(600); // Es vital esperar la animación de traslado hacia "0 Products received"
            processCount = await processButtonLocator.count();
        }

        console.log('Confirming QC Packing...');
        const confirmBtn = activeModal.locator('button').filter({ hasText: /Confirm/i }).first();
        await this.waitForElementToBeVisible(confirmBtn);
        
        await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
        await confirmBtn.click({ force: true });
        
        await this.page.waitForTimeout(1000); // Esperar que cierre el modal
        console.log('✅ QC Packing completed');
    }

    // ─── Actions (Action Bar Buttons) ────────────────────────────────

    /** Click the blue "GET RATES" button at the bottom of the screen. */
    async clickGetRates(): Promise<void> {
        console.log('Clicking Get Rates...');
        const btn = this.page.locator('button[aria-label="GET RATES"]').first();

        if (await this.isElementVisible(btn, 5000)) {
            await this.click(btn);
        } else {
            const fallback = this.page.locator('button').filter({ hasText: /^GET RATES$/i }).first();
            await this.click(fallback);
        }

        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(2000); // Give modal time to load rates
        console.log('✅ GET RATES clicked — waiting for results');
    }

    /** Click the green "SAVE & CONFIRM" button. */
    async clickSaveAndConfirm(): Promise<void> {
        console.log('Clicking Save & Confirm...');
        const btn = this.page.locator('button[aria-label="SAVE & CONFIRM"]').first();
        await this.waitForElementToBeVisible(btn);
        
        // Ensure it's not disabled before clicking
        await expect(btn).toBeEnabled({ timeout: 10000 });
        
        await this.click(btn);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log('✅ SAVE & CONFIRM clicked');
    }

    /** Click the red "GET LABELS" button. */
    async clickGetLabels(): Promise<void> {
        console.log('Clicking Get Labels...');
        const btn = this.page.locator('button[aria-label="GET LABELS"]').first();
        await this.waitForElementToBeVisible(btn);
        
        // Wait until it becomes enabled
        await expect(btn).toBeEnabled({ timeout: 15000 });
        
        await this.click(btn);
        await this.page.waitForTimeout(2000);
        console.log('✅ GET LABELS clicked');
    }

    // ─── Rate selection modal ───────────────────────────────────────

    /** In the Available Rates modal, change items per page to 50. */
    async changeItemsPerPageTo50(): Promise<void> {
        console.log('Changing items per page to 50...');
        // Look for the mat-select that handles pagination in the modal
        const select = this.page.locator('mat-dialog-container mat-select').first();
        if (await this.isElementVisible(select, 3000)) {
            await this.click(select);
            await this.page.waitForTimeout(500);
            
            const option50 = this.page.locator('mat-option').filter({ hasText: '50' }).first();
            await this.waitForElementToBeVisible(option50);
            await this.click(option50);
            await this.page.waitForTimeout(1000); // Wait for results to reload
            console.log('✅ Items per page set to 50');
        } else {
            console.log('⚠️ Items per page dropdown not found or not needed');
        }
    }

    /**
     * Select a rate from the rates table based on a text match (e.g. "Ground Advantage").
     * If the preferred rate is not found, it selects the first available rate.
     */
    async selectRateByText(carrierOrMethod: string): Promise<void> {
        console.log(`Searching for rate matching: "${carrierOrMethod}"...`);
        
        // 1. Wait for rates table to have at least one row (up to 30s)
        const allRows = this.page.locator('mat-dialog-container tbody tr');
        try {
            await allRows.first().waitFor({ state: 'visible', timeout: 30000 });
        } catch (e) {
            console.error('❌ Timeout waiting for rates to load in modal.');
            throw new Error('No rates appeared in the modal after 30 seconds.');
        }
        
        const rowCount = await allRows.count();
        console.log(`  Found ${rowCount} total rates in modal`);

        // 2. Try to find the preferred rate
        const preferredRow = allRows.filter({ hasText: new RegExp(carrierOrMethod, 'i') }).first();
        
        if (await this.isElementVisible(preferredRow, 5000)) {
            console.log(`✅ Preferred rate "${carrierOrMethod}" found. Selecting...`);
            await this.click(preferredRow);
        } else {
            console.log(`⚠️ Rate "${carrierOrMethod}" not available. Selecting the FIRST one as fallback.`);
            const firstRow = allRows.first();
            
            // Extract some text for the log to know what was selected
            const firstRowText = await firstRow.textContent();
            console.log(`👉 Fallback rate: ${firstRowText?.replace(/\s+/g, ' ').trim()}`);
            
            await this.click(firstRow);
        }

        await this.page.waitForTimeout(1000);
    }

    // ─── Hazmat ─────────────────────────────────────────────────────

    /** Select a hazmat code from the dropdown. */
    async selectHazmatCode(code: string): Promise<void> {
        console.log(`Selecting Hazmat code: ${code}`);
        const select = this.page.locator('select#hazmatCode');
        await this.waitForElementToBeVisible(select);
        await select.selectOption(code);
        await this.page.waitForTimeout(500);
        console.log(`✅ Hazmat code selected: ${code}`);
    }

    // ─── Mat-Select dropdowns ───────────────────────────────────────

    /** Select an option from a mat-select dropdown by its visible text. */
    async selectMatOption(dropdownLabel: string, optionText: string): Promise<void> {
        console.log(`Selecting "${optionText}" from "${dropdownLabel}" dropdown...`);
        const dropdown = this.page.locator('mat-form-field').filter({ hasText: new RegExp(dropdownLabel, 'i') }).first();

        if (await this.isElementVisible(dropdown, 3000)) {
            await dropdown.click();
            await this.page.waitForTimeout(500);

            const option = this.page.locator('mat-option').filter({ hasText: new RegExp(optionText, 'i') }).first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
            await this.page.waitForTimeout(500);
            console.log(`✅ Selected "${optionText}" from "${dropdownLabel}"`);
        }
    }

    // ─── Data capture ───────────────────────────────────────────────

    /** Read Order details section data. */
    async getOrderDetailsData(): Promise<Record<string, string>> {
        console.log('Capturing Order details...');
        const details: Record<string, string> = {};

        // Try to read labeled form fields
        const labels = ['Order number', 'Shipment number', 'Status'];
        for (const label of labels) {
            const input = this.page.locator('mat-form-field').filter({ hasText: new RegExp(label, 'i') }).locator('input').first();
            if (await this.isElementVisible(input, 2000)) {
                details[label] = await input.inputValue();
            }
        }

        console.log(`📋 Order details: ${JSON.stringify(details)}`);
        return details;
    }

    /** Capture the selected rate information (price, carrier name). */
    async getSelectedRate(): Promise<{ price: string | null; carrier: string | null }> {
        const priceEl = this.page.locator('.text-green-600, [class*="text-green"]').first();
        const price = await this.isElementVisible(priceEl, 2000) ? await priceEl.textContent() : null;

        const carrierEl = this.page.locator('.text-xl.font-bold, [class*="carrier-name"]').first();
        const carrier = await this.isElementVisible(carrierEl, 2000) ? await carrierEl.textContent() : null;

        console.log(`💰 Selected rate: ${price ?? 'N/A'} | Carrier: ${carrier ?? 'N/A'}`);
        return { price: price?.trim() ?? null, carrier: carrier?.trim() ?? null };
    }
}
