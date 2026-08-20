import { Page } from "@playwright/test";
import BasePage from "../../lib/basepage";

/**
 * Page Object: XenvioNewOrderPage (v2)
 *
 * The New Order page still uses mat-form-field for Ship-to, Boxes, and Order Details.
 * This v2 page object is functionally identical to the legacy one.
 * The only difference is it lives in page-objects-v2/ for import independence.
 */
export class XenvioNewOrderPage extends BasePage {

    constructor(page: Page) {
        super(page);
    }

    // ─── Tab 1: Navigate to New Order ───────────────────────────────

    async navigateToNewOrder(): Promise<void> {
        console.log('Clicking "New Order" button...');
        // PrimeNG header uses p-button for "New Order"
        const newOrderBtn = this.page.locator('p-button:has-text("New Order"), button:has-text("New Order"), a:has-text("New Order")').first();
        await this.waitForElementToBeVisible(newOrderBtn);
        await this.click(newOrderBtn);
        await this.page.waitForURL(/new-order/, { timeout: 15000 });
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Navigated to New Order page');
    }

    // ─── Tab 1: Fill Recipient (Ship to) ────────────────────────────

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

        // ⚠️ The New Order product form fields are in this order:
        //    qty → weight → length → width → height
        //    (NOT qty → length → width → height → weight)
        const values = [dimensions.qty, dimensions.weight, dimensions.length, dimensions.width, dimensions.height];
        const labels = ['qty', 'weight', 'length', 'width', 'height'];
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
        console.log('Saving box dimensions...');
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
                console.log(`✅ Create box success`);
                return;
            }
        }
        throw new Error('Save box button not found or disabled');
    }

    // ─── Tab 3: Order details ────────────────────────────────────────

    async selectFulfillmentLocation(warehouseName: string): Promise<void> {
        console.log(`Selecting Fulfillment location: ${warehouseName}`);
        const dropdown = this.page.locator('mat-form-field').filter({ hasText: /fulfillment location|facility|warehouse/i }).first();
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

    async getOrderDetails(): Promise<{ orderNumber: string | null; shipmentNumber: string | null }> {
        const orderNumber = await this.getFormFieldValue('Order number');
        const shipmentNumber = await this.getFormFieldValue('Shipment number');
        console.log(`📋 Order number: ${orderNumber ?? 'N/A'}`);
        console.log(`📦 Shipment number: ${shipmentNumber ?? 'N/A'}`);
        return { orderNumber, shipmentNumber };
    }

    private async getFormFieldValue(labelText: string): Promise<string | null> {
        const input = this.page
            .locator('mat-form-field')
            .filter({ hasText: new RegExp(labelText, 'i') })
            .locator('input')
            .first();

        if (await this.isElementVisible(input, 3000)) {
            return await input.inputValue();
        }
        return null;
    }

    async waitForOrderCreated(timeout = 20000): Promise<void> {
        console.log('Waiting for order creation to finalize...');
        await this.page.waitForURL(/shipper-view\?shipment_number=/, { timeout });
        console.log('✅ Order creation confirmed - redirected to shipper-view');
    }

    async getShipmentNumberFromUrl(): Promise<string | null> {
        const shipmentNumber = new URL(this.page.url()).searchParams.get('shipment_number');
        if (shipmentNumber) {
            console.log(`📦 Shipment Number captured: ${shipmentNumber}`);
        } else {
            console.log('⚠️ Could not extract shipment_number from URL');
        }
        return shipmentNumber;
    }

    async createOrderFlow(recipientData: any, dimensions: any, warehouseName: string): Promise<string | null> {
        console.log(`🚀 Starting full Create Order flow for: ${recipientData.name}`);

        await this.navigateToNewOrder();
        await this.fillRecipientInfo(recipientData);
        await this.clickContinue();

        await this.clickAddProduct();
        await this.fillProductDimensions(dimensions);
        await this.clickSaveProduct();

        await this.clickContinue();
        await this.selectFulfillmentLocation(warehouseName);

        const { shipmentNumber } = await this.getOrderDetails();
        await this.clickSaveOrder();
        await this.waitForOrderCreated();

        const finalShipment = await this.getShipmentNumberFromUrl() ?? shipmentNumber;
        console.log(`✅ Order flow completed! Final Shipment: ${finalShipment}`);
        return finalShipment;
    }
}
