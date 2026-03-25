import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Xenvio New Order Page Object
 * 
 * Handles the creation of a new order in the Xenvio shipper-view.
 * Flow: Shipper View → New Order → Fill Recipient → Add Product → Select Carrier → Submit
 * 
 * The form uses Angular Material components (mat-input, mat-option, mat-form-field).
 */
export class XenvioNewOrderPage extends BasePage {

    // ─── Navigation ───
    readonly newOrderButton: Locator;

    // ─── Recipient Information (Step 1) ───
    readonly recipientNameInput: Locator;
    readonly recipientCityInput: Locator;
    readonly recipientZipInput: Locator;
    readonly recipientCountryArea: Locator;
    readonly recipientReferenceInput: Locator;

    // ─── Action Buttons ───
    readonly continueButton: Locator;
    readonly addProductButton: Locator;
    readonly saveProductButton: Locator;
    readonly submitOrderButton: Locator;

    // ─── Product Information (Step 2) ───
    readonly productDimensionsInput: Locator;

    // ─── Carrier Selection (Step 3) ───
    readonly carrierDropdown: Locator;
    readonly orderReferenceInput: Locator;

    constructor(page: Page) {
        super(page);

        // Navigation - the "New Order" button in Shipper View
        this.newOrderButton = page.locator('button:has-text("New Order"), a:has-text("New Order"), span:has-text("New Order")').first();

        // Recipient fields - using mat-form-field labels as anchors for robust selectors
        this.recipientNameInput = page.locator('mat-form-field').filter({ hasText: /name/i }).locator('input').first();
        this.recipientCityInput = page.locator('mat-form-field').filter({ hasText: /city/i }).locator('input').first();
        this.recipientZipInput = page.locator('mat-form-field').filter({ hasText: /zip|postal/i }).locator('input').first();
        this.recipientCountryArea = page.locator('div.w-full');
        this.recipientReferenceInput = page.locator('mat-form-field').filter({ hasText: /reference/i }).locator('input').first();

        // Action buttons - using CSS classes from the recording
        this.continueButton = page.locator('button.px-12.bg-bt_primary').first();
        this.addProductButton = page.locator('button[type="submit"].border-gray-200').first();
        this.saveProductButton = page.locator('button[type="submit"].bg-green-600').first();
        this.submitOrderButton = page.locator('button.px-12.bg-bt_primary').first();

        // Product dimensions - the input for weight/dimensions in the product modal
        this.productDimensionsInput = page.locator('mat-form-field').filter({ hasText: /weight|qty|quantity/i }).locator('input').first();

        // Carrier selection
        this.carrierDropdown = page.locator('mat-form-field').filter({ hasText: /carrier|service/i }).locator('div.mat-mdc-form-field-infix').first();
        this.orderReferenceInput = page.locator('input[type="text"]').last();
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Navigate to New Order
    // ═══════════════════════════════════════════════════════════════

    /**
     * Click the "New Order" button from the Shipper View to start creating a new order.
     * Waits for navigation to /new-order.
     */
    async navigateToNewOrder(): Promise<void> {
        console.log('Clicking "New Order" button...');
        await this.waitForElementToBeVisible(this.newOrderButton);
        await this.click(this.newOrderButton);
        await this.page.waitForURL(/new-order/, { timeout: 15000 });
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Navigated to New Order page');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Fill Recipient Information
    // ═══════════════════════════════════════════════════════════════

    /**
     * Fill in the recipient/destination details for the new order.
     * 
     * Actual form layout (from screenshot inspection):
     *   ┌─────────────────────────┬─────────────────────────┐
     *   │ Name                    │ Company                 │
     *   ├─────────────────────────┼─────────────────────────┤
     *   │ Email*                  │ Phone                   │
     *   ├─────────────────────────┴─────────────────────────┤
     *   │ Parse address                          [Parse]    │
     *   ├─────────────────────────────────────────────────────┤
     *   │ Address 1*                                        │
     *   ├─────────────────────────┬─────────────────────────┤
     *   │ Address 2               │ Address 3               │
     *   ├─────────────────────────┼─────────────────────────┤
     *   │ State*                  │ City*                   │
     *   ├─────────────────────────┼─────────────────────────┤
     *   │ Country*                │ Zip*                    │
     *   └─────────────────────────┴─────────────────────────┘
     * 
     * Required fields marked with * : Email, Address 1, State, City, Country, Zip
     * 
     * @param recipientData Object with all required and optional recipient fields
     */
    async fillRecipientInfo(recipientData: {
        name: string;
        company?: string;
        email: string;
        phone?: string;
        address1: string;
        address2?: string;
        state: string;
        city: string;
        zip: string;
        country: string;
    }): Promise<void> {
        console.log('Filling recipient information...');

        // Wait for the new order form to be fully loaded
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);

        // Fill fields by their exact label text (matched from the screenshot)
        await this.fillFormField('Name', recipientData.name);

        if (recipientData.company) {
            await this.fillFormField('Company', recipientData.company);
        }

        await this.fillFormField('Email', recipientData.email);

        if (recipientData.phone) {
            await this.fillFormField('Phone', recipientData.phone);
        }

        await this.fillFormField('Address 1', recipientData.address1);

        if (recipientData.address2) {
            await this.fillFormField('Address 2', recipientData.address2);
        }

        await this.fillFormField('State', recipientData.state);
        await this.fillFormField('City', recipientData.city);

        // Country uses autocomplete dropdown, handle separately
        await this.selectCountry(recipientData.country);

        await this.fillFormField('Zip', recipientData.zip);

        console.log('✅ Recipient information filled successfully');
    }

    /**
     * Fill a form field by matching its mat-form-field label text.
     * Uses exact label matching to avoid filling the wrong field.
     * 
     * @param labelText The label text to match (e.g., "Name", "Email", "Address 1")
     * @param value The value to type
     */
    private async fillFormField(labelText: string, value: string): Promise<void> {
        // Use exact word boundary matching to avoid ambiguity
        // e.g., "Address 1" should not match "Address 2" or "Address 3"
        const input = this.page.locator('mat-form-field')
            .filter({ hasText: new RegExp(`^\\s*${labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') })
            .locator('input')
            .first();

        const isVisible = await this.isElementVisible(input, 5000);

        if (isVisible) {
            await this.type(input, value);
            console.log(`  → Filled "${labelText}" with: ${value}`);
        } else {
            console.log(`  ⚠ Field "${labelText}" not found, skipping`);
        }
    }

    /**
     * Select a country by typing into the country field and picking from the autocomplete.
     * Tries label-based match first, then falls back to a broader search.
     * @param countryCode Country code or partial name (e.g., "us", "United States")
     */
    async selectCountry(countryCode: string): Promise<void> {
        console.log(`Selecting country: ${countryCode}`);

        // Try finding the country field by label
        let countryInput = this.page.locator('mat-form-field')
            .filter({ hasText: /country/i })
            .locator('input')
            .first();

        let isVisible = await this.isElementVisible(countryInput, 3000);

        if (!isVisible) {
            // Fallback: try finding by placeholder or the main content area
            console.log('  ⚠ Country label not found, trying alternative selectors...');
            countryInput = this.page.locator('mat-form-field input.mat-mdc-input-element').nth(4);
            isVisible = await this.isElementVisible(countryInput, 3000);
        }

        if (!isVisible) {
            // Last resort: click on the main form area and type
            console.log('  ⚠ Using last resort: clicking on form area');
            countryInput = this.page.locator('input.mat-mdc-input-element').nth(4);
        }

        await this.waitForElementToBeVisible(countryInput);
        await countryInput.fill('');
        await countryInput.pressSequentially(countryCode, { delay: 100 });

        // Wait for autocomplete options to appear
        await this.page.waitForTimeout(1000);

        // Click the first matching option from the mat-option dropdown
        const countryOption = this.page.locator('mat-option .mdc-list-item__primary-text').first();
        await countryOption.waitFor({ state: 'visible', timeout: 5000 });
        await countryOption.click();

        await this.page.waitForTimeout(500);
        console.log(`  → Country selected: ${countryCode}`);
    }

    /**
     * Click the "Continue/Next" button to proceed to the next step.
     */
    async clickContinue(): Promise<void> {
        console.log('Clicking Continue button...');
        const continueBtn = this.page.locator('button.bg-bt_primary').first();
        await this.waitForElementToBeVisible(continueBtn);
        await this.click(continueBtn);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log('✅ Continue clicked');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Add Product with Dimensions
    // ═══════════════════════════════════════════════════════════════

    /**
     * Click the "Add Product" button to open the product form/modal.
     */
    async clickAddProduct(): Promise<void> {
        console.log('Clicking Add Product button...');
        const addBtn = this.page.locator('button[type="submit"].border-gray-200, button:has-text("Add")').first();
        await this.waitForElementToBeVisible(addBtn);
        await this.click(addBtn);
        await this.page.waitForTimeout(1000);
        console.log('✅ Add Product modal opened');
    }

    /**
     * Fill product dimensions/weight by filling each input individually.
     * 
     * Uses .fill() on each input to properly trigger Angular's change detection,
     * followed by a blur/Tab to validate. keyboard.type() does NOT trigger Angular
     * reactive forms, causing the save button to remain disabled.
     * 
     * Recording reference: mat-input-39 was clicked, then "1⇥1⇥1⇥1⇥1" was typed.
     * 
     * @param dimensions Object with qty, length, width, height, weight
     */
    async fillProductDimensions(dimensions: {
        qty: string;
        length: string;
        width: string;
        height: string;
        weight: string;
    }): Promise<void> {
        console.log('Filling product dimensions...');

        // Wait for the product form/section to be fully rendered
        await this.page.waitForTimeout(1000);

        // Find all mat-form-field inputs currently on the page
        const allInputs = this.page.locator('mat-form-field input.mat-mdc-input-element');
        const inputCount = await allInputs.count();
        console.log(`  Found ${inputCount} inputs in product form`);

        // The dimension fields are the last group of inputs added after "Add Product" click
        // We fill each one individually with .fill() to trigger Angular's change detection
        const dimensionValues = [dimensions.qty, dimensions.length, dimensions.width, dimensions.height, dimensions.weight];
        const dimensionLabels = ['qty', 'length', 'width', 'height', 'weight'];

        // Calculate the starting index for dimension inputs (last 5 inputs)
        const startIndex = Math.max(0, inputCount - dimensionValues.length);

        for (let i = 0; i < dimensionValues.length; i++) {
            const input = allInputs.nth(startIndex + i);
            const isInputVisible = await this.isElementVisible(input, 3000);

            if (isInputVisible) {
                // Use .fill() to trigger Angular's change detection
                await input.click();
                await input.fill(dimensionValues[i]);
                // Dispatch input event to ensure Angular picks up the change
                await input.dispatchEvent('input');
                await input.dispatchEvent('change');
                // Press Tab to trigger blur/validation
                await input.press('Tab');
                console.log(`  → Filled ${dimensionLabels[i]}: ${dimensionValues[i]}`);
            } else {
                console.log(`  ⚠ Input ${dimensionLabels[i]} at index ${startIndex + i} not visible`);
            }
        }

        // Small wait for Angular to process all validations
        await this.page.waitForTimeout(500);
        console.log(`  → Dimensions set: qty=${dimensions.qty}, L=${dimensions.length}, W=${dimensions.width}, H=${dimensions.height}, Wt=${dimensions.weight}`);
    }

    /**
     * Click the green "Save" button to save the product.
     * Uses multiple selectors with fallback since the button may have
     * different class combinations or conditional rendering.
     */
    async clickSaveProduct(): Promise<void> {
        console.log('Saving product...');

        // Try multiple selectors for the green save button
        const selectors = [
            'button.bg-green-600[type="submit"]',
            'button.bg-green-600',
            'button[type="submit"]:has-text("Save")',
            'button:has-text("Save")',
        ];

        for (const selector of selectors) {
            const btn = this.page.locator(selector).first();
            const isVisible = await this.isElementVisible(btn, 3000);

            if (isVisible) {
                // Wait until the button is enabled (not disabled)
                try {
                    await btn.waitFor({ state: 'visible', timeout: 5000 });
                    const isEnabled = await btn.isEnabled({ timeout: 5000 });
                    if (isEnabled) {
                        await this.click(btn);
                        await this.page.waitForTimeout(1000);
                        console.log(`✅ Product saved (selector: ${selector})`);
                        return;
                    } else {
                        console.log(`  ⚠ Button found but disabled: ${selector}`);
                    }
                } catch {
                    console.log(`  ⚠ Button timeout: ${selector}`);
                }
            }
        }

        // Last resort: click any green-ish button
        console.log('  ⚠ Trying last resort: any green button');
        const greenBtn = this.page.locator('button[class*="green"]').first();
        await this.waitForElementToBeVisible(greenBtn, 10000);
        await this.click(greenBtn);
        await this.page.waitForTimeout(1000);
        console.log('✅ Product saved (last resort)');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Order Details — Select Fulfillment Location & Save
    // ═══════════════════════════════════════════════════════════════

    /**
     * Select the Fulfillment location from the dropdown on the "Order details" tab.
     * 
     * The dropdown contains warehouse options (e.g., "qa20", "qa20-1", "qa20_prueba").
     * Uses the WAREHOUSE_XENVIO env variable value to select the correct warehouse.
     * 
     * @param warehouseName The exact warehouse name to select (e.g., "qa20")
     */
    async selectFulfillmentLocation(warehouseName: string): Promise<void> {
        console.log(`Selecting Fulfillment location: ${warehouseName}`);

        // Click the Fulfillment location dropdown
        const fulfillmentDropdown = this.page.locator('mat-form-field')
            .filter({ hasText: /fulfillment location/i })
            .first();

        await this.waitForElementToBeVisible(fulfillmentDropdown);
        await fulfillmentDropdown.click();

        // Wait for the dropdown options to appear
        await this.page.waitForTimeout(1000);

        // Select the exact warehouse option
        const warehouseOption = this.page.locator('mat-option .mdc-list-item__primary-text')
            .filter({ hasText: new RegExp(`^${warehouseName}$`) });

        await warehouseOption.waitFor({ state: 'visible', timeout: 5000 });
        await warehouseOption.click();

        await this.page.waitForTimeout(500);
        console.log(`✅ Fulfillment location selected: ${warehouseName}`);
    }

    /**
     * Click the "Save Order" button to finalize the order creation.
     */
    async clickSaveOrder(): Promise<void> {
        console.log('Clicking Save Order...');

        const saveOrderBtn = this.page.locator('button:has-text("Save Order")').first();
        const isVisible = await this.isElementVisible(saveOrderBtn, 5000);

        if (isVisible) {
            await this.waitForElementToBeVisible(saveOrderBtn);
            await this.click(saveOrderBtn);
        } else {
            // Fallback: look for the primary submit button
            const fallbackBtn = this.page.locator('button.bg-bt_primary, button[type="submit"]').last();
            await this.waitForElementToBeVisible(fallbackBtn);
            await this.click(fallbackBtn);
        }

        await this.page.waitForLoadState('networkidle');
        console.log('✅ Save Order clicked');
    }

    // ═══════════════════════════════════════════════════════════════
    // FULL FLOW: Create a Complete New Order
    // ═══════════════════════════════════════════════════════════════

    /**
     * Execute the complete new order creation flow.
     * This orchestrates all steps from navigation to submission.
     * 
     * @param orderData All data needed to create the order
     * @returns The final URL after order creation (should contain shipment_number)
     */
    async createNewOrder(orderData: {
        recipient: {
            name: string;
            company?: string;
            email: string;
            phone?: string;
            address1: string;
            address2?: string;
            state: string;
            city: string;
            zip: string;
            country: string;
        };
        product: {
            qty: string;
            length: string;
            width: string;
            height: string;
            weight: string;
        };
        fulfillmentLocation: string;
    }): Promise<string> {
        // Step 1: Navigate to new order page
        await this.navigateToNewOrder();

        // Step 2: Fill recipient information (Ship to tab)
        await this.fillRecipientInfo(orderData.recipient);

        // Step 3: Click Next to move to Boxes tab
        await this.clickContinue();

        // Step 4: Add product
        await this.clickAddProduct();

        // Step 5: Fill product dimensions
        await this.fillProductDimensions(orderData.product);

        // Step 6: Save the product
        await this.clickSaveProduct();

        // Step 7: Click Next to move to Order details tab
        await this.clickContinue();

        // Step 8: Select Fulfillment location
        await this.selectFulfillmentLocation(orderData.fulfillmentLocation);

        // Step 9: Save the order
        await this.clickSaveOrder();

        // Wait for redirect to shipper-view with shipment_number
        await this.page.waitForTimeout(2000);
        const finalUrl = this.page.url();
        console.log(`🎉 Order created! Final URL: ${finalUrl}`);

        return finalUrl;
    }

    /**
     * Extract the shipment number from the current URL after order creation.
     * Expected URL format: .../shipper-view?shipment_number=S141_XXXXXX&...
     * @returns The shipment number or null if not found
     */
    async getShipmentNumberFromUrl(): Promise<string | null> {
        const url = new URL(this.page.url());
        const shipmentNumber = url.searchParams.get('shipment_number');

        if (shipmentNumber) {
            console.log(`📦 Shipment Number captured: ${shipmentNumber}`);
        } else {
            console.log('⚠️ Could not extract shipment_number from URL');
        }

        return shipmentNumber;
    }

    /**
     * Wait for the order creation to complete by checking for URL redirect.
     * @param timeout Maximum time to wait in ms
     */
    async waitForOrderCreated(timeout = 20000): Promise<void> {
        console.log('Waiting for order creation to finalize...');
        await this.page.waitForURL(/shipper-view\?shipment_number=/, { timeout });
        console.log('✅ Order creation confirmed - redirected to shipper-view');
    }
}
