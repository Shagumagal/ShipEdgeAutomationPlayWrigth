import { Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Page Object for the Xenvio New Order flow.
 *
 * Form flow (3 tabs):
 *   1. Ship to      → fill recipient details → Next
 *   2. Boxes        → add product + dimensions → Next
 *   3. Order details → select Fulfillment location → Save Order
 */
export class XenvioNewOrderPage extends BasePage {

    constructor(page: Page) {
        super(page);
    }

    // ─── Tab 1: Navigate to New Order ───────────────────────────────

    async navigateToNewOrder(): Promise<void> {
        console.log('Clicking "New Order" button...');
        const newOrderBtn = this.page.locator('button:has-text("New Order"), a:has-text("New Order")').first();
        await this.waitForElementToBeVisible(newOrderBtn);
        await this.click(newOrderBtn);
        await this.page.waitForURL(/new-order/, { timeout: 15000 });
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Navigated to New Order page');
    }

    // ─── Tab 1: Fill Recipient (Ship to) ────────────────────────────

    /**
     * Fill all recipient fields on the "Ship to" tab.
     * Required: name, email, address1, state, city, zip, country.
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
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);

        await this.fillFormField('Name', recipientData.name);
        if (recipientData.company) await this.fillFormField('Company', recipientData.company);
        await this.fillFormField('Email', recipientData.email);
        if (recipientData.phone) await this.fillFormField('Phone', recipientData.phone);
        await this.fillFormField('Address 1', recipientData.address1);
        if (recipientData.address2) await this.fillFormField('Address 2', recipientData.address2);
        await this.fillFormField('State', recipientData.state);
        await this.fillFormField('City', recipientData.city);
        await this.selectCountry(recipientData.country);
        await this.fillFormField('Zip', recipientData.zip);

        console.log('✅ Recipient information filled successfully');
    }

    /** Fill a mat-form-field input by its label text. */
    private async fillFormField(labelText: string, value: string): Promise<void> {
        const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const input = this.page
            .locator('mat-form-field')
            .filter({ hasText: new RegExp(`^\\s*${escaped}`, 'i') })
            .locator('input')
            .first();

        if (await this.isElementVisible(input, 5000)) {
            await this.type(input, value);
            console.log(`  → Filled "${labelText}" with: ${value}`);
        } else {
            console.log(`  ⚠ Field "${labelText}" not found, skipping`);
        }
    }

    /** Type into the Country autocomplete and select the first result. */
    async selectCountry(countryCode: string): Promise<void> {
        console.log(`Selecting country: ${countryCode}`);
        const countryInput = this.page
            .locator('mat-form-field')
            .filter({ hasText: /country/i })
            .locator('input')
            .first();

        await this.waitForElementToBeVisible(countryInput);
        await countryInput.fill('');
        await countryInput.pressSequentially(countryCode, { delay: 100 });
        await this.page.waitForTimeout(1000);

        const option = this.page.locator('mat-option .mdc-list-item__primary-text').first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await this.page.waitForTimeout(500);
        console.log(`  → Country selected: ${countryCode}`);
    }

    // ─── Shared: Next / Continue button ─────────────────────────────

    async clickContinue(): Promise<void> {
        console.log('Clicking Continue button...');
        const btn = this.page.locator('button.bg-bt_primary').first();
        await this.waitForElementToBeVisible(btn);
        await this.click(btn);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
        console.log('✅ Continue clicked');
    }

    // ─── Tab 2: Boxes (Add product) ──────────────────────────────────

    async clickAddProduct(): Promise<void> {
        console.log('Clicking Add Product button...');
        const addBtn = this.page.locator('button[type="submit"].border-gray-200, button:has-text("Add")').first();
        await this.waitForElementToBeVisible(addBtn);
        await this.click(addBtn);
        await this.page.waitForTimeout(1000);
        console.log('✅ Add Product modal opened');
    }

    /**
     * Fill product dimension inputs (qty, length, width, height, weight).
     * Uses .fill() + dispatchEvent to trigger Angular reactive form validation.
     */
    async fillProductDimensions(dimensions: {
        qty: string;
        length: string;
        width: string;
        height: string;
        weight: string;
    }): Promise<void> {
        console.log('Filling product dimensions...');
        await this.page.waitForTimeout(1000);

        const allInputs = this.page.locator('mat-form-field input.mat-mdc-input-element');
        const inputCount = await allInputs.count();
        console.log(`  Found ${inputCount} inputs in product form`);

        const values = [dimensions.qty, dimensions.length, dimensions.width, dimensions.height, dimensions.weight];
        const labels = ['qty', 'length', 'width', 'height', 'weight'];
        const startIndex = Math.max(0, inputCount - values.length);

        for (let i = 0; i < values.length; i++) {
            const input = allInputs.nth(startIndex + i);
            if (await this.isElementVisible(input, 3000)) {
                await input.click();
                await input.fill(values[i]);
                await input.dispatchEvent('input');
                await input.dispatchEvent('change');
                await input.press('Tab');
                console.log(`  → Filled ${labels[i]}: ${values[i]}`);
            }
        }
        await this.page.waitForTimeout(500);
    }

    async clickSaveProduct(): Promise<void> {
        console.log('Saving product...');
        const selectors = [
            'button.bg-green-600[type="submit"]',
            'button.bg-green-600',
            'button[type="submit"]:has-text("Save")',
            'button:has-text("Save")',
        ];

        for (const selector of selectors) {
            const btn = this.page.locator(selector).first();
            if (await this.isElementVisible(btn, 3000) && await btn.isEnabled()) {
                await this.click(btn);
                await this.page.waitForTimeout(1000);
                console.log(`✅ Product saved`);
                return;
            }
        }
        throw new Error('Save product button not found or disabled');
    }

    // ─── Tab 3: Order details ────────────────────────────────────────

    /** Select the fulfillment warehouse from the dropdown. */
    async selectFulfillmentLocation(warehouseName: string): Promise<void> {
        console.log(`Selecting Fulfillment location: ${warehouseName}`);
        const dropdown = this.page.locator('mat-form-field').filter({ hasText: /fulfillment location/i }).first();
        await this.waitForElementToBeVisible(dropdown);
        await dropdown.click();
        await this.page.waitForTimeout(1000);

        const option = this.page.locator('mat-option .mdc-list-item__primary-text')
            .filter({ hasText: new RegExp(`^${warehouseName}$`) });
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await this.page.waitForTimeout(500);
        console.log(`✅ Fulfillment location selected: ${warehouseName}`);
    }

    async clickSaveOrder(): Promise<void> {
        console.log('Clicking Save Order...');
        const saveBtn = this.page.locator('button:has-text("Save Order")').first();
        if (await this.isElementVisible(saveBtn, 5000)) {
            await this.click(saveBtn);
        } else {
            const fallback = this.page.locator('button.bg-bt_primary, button[type="submit"]').last();
            await this.waitForElementToBeVisible(fallback);
            await this.click(fallback);
        }
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Save Order clicked');
    }

    // ─── Post-creation helpers ───────────────────────────────────────

    /** Wait for redirect to shipper-view with shipment_number in the URL. */
    async waitForOrderCreated(timeout = 20000): Promise<void> {
        console.log('Waiting for order creation to finalize...');
        await this.page.waitForURL(/shipper-view\?shipment_number=/, { timeout });
        console.log('✅ Order creation confirmed - redirected to shipper-view');
    }

    /** Extract shipment_number from the current URL query params. */
    async getShipmentNumberFromUrl(): Promise<string | null> {
        const shipmentNumber = new URL(this.page.url()).searchParams.get('shipment_number');
        if (shipmentNumber) {
            console.log(`📦 Shipment Number captured: ${shipmentNumber}`);
        } else {
            console.log('⚠️ Could not extract shipment_number from URL');
        }
        return shipmentNumber;
    }
}
