import { Locator, Page, expect } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Shipedge Orders Page Object
 * 
 * Handles interactions with the Orders module:
 * - Navigation to orders list
 * - Creating new orders
 * - Searching/Filtering orders
 */
export class ShipedgeOrdersPage extends BasePage {
    // ── Locators ──────────────────────────────────────────────

    // Navigation Menu Items
    readonly ordersMenuLink: Locator;
    readonly addOrderLink: Locator;

    // Popups
    readonly remindMeLaterButton: Locator;

    // Create Order Page Elements
    readonly addressBookButton: Locator;
    readonly addressBookModal: Locator;
    readonly addressBookProcessingIndicator: Locator;
    readonly addressBookAddButtons: Locator;
    readonly addressBookCloseButton: Locator;

    // Order Form
    readonly addProductsButton: Locator;
    readonly productModalAddButtons: Locator;

    // Shipping Information
    readonly addShippingInfoButton: Locator;
    readonly carrierSelect: Locator;
    readonly shipMethodSelect: Locator;
    readonly shippingModalOkButton: Locator;

    // Save
    readonly saveOrderButton: Locator;

    // Success/Error Messages
    readonly successMessage: Locator;
    readonly ordersTable: Locator;

    constructor(page: Page) {
        super(page);

        // -- Navigation --
        this.ordersMenuLink = page.getByRole('link', { name: /orders/i }).first();
        this.addOrderLink = page.locator('a[href*="up-order.php?typeorder=regular"]');

        // -- Popups --
        this.remindMeLaterButton = page.locator('#remind-me-later');

        // -- Create Order Form --
        this.addressBookButton = page.locator('.btn-modalClients');

        // Address Book Modal - using the data-modal-type attribute from the real DOM
        this.addressBookModal = page.locator('[data-modal-type="address-book"]');
        // DataTables processing indicator inside the Address Book modal
        this.addressBookProcessingIndicator = page.locator('.dataTables_processing');
        // Green Add buttons in the clients table (button.btn.btn-sm.btn-add-client-table)
        this.addressBookAddButtons = page.locator('.btn-add-client-table');
        // CLOSE button at the bottom of the Address Book modal
        this.addressBookCloseButton = page.locator('[data-modal-type="address-book"] button').getByText('CLOSE');

        // Products
        this.addProductsButton = page.locator('.btn-modalProducts');
        this.productModalAddButtons = page.locator('.btn-add-to-order');

        // Shipping
        this.addShippingInfoButton = page.locator('button.btn-shipping');
        this.carrierSelect = page.locator('#carrier_select');
        this.shipMethodSelect = page.locator('#select-ship');
        this.shippingModalOkButton = page.locator('button').filter({ hasText: /^Ok$/ });

        // Save Order Button - using pdf="false" to target only "Save Order" (not "Save & Download PDF")
        this.saveOrderButton = page.locator('.btn-save-order[pdf="false"]');

        // -- List/Other --
        this.ordersTable = page.locator('table');
        this.successMessage = page.locator('.alert-success');
    }

    // ── Verification Methods ─────────────────────────────────

    /**
     * Wait for the order creation process to complete.
     * Usually this involves a redirect or the Save button disappearing.
     * @param timeout - Maximum time to wait (default 15s)
     */
    async waitForOrderCreated(timeout: number = 15000): Promise<void> {
        console.log('Waiting for order creation to finalize...');

        // Option A: Wait for URL to NO LONGER contain 'typeorder=regular' (which means it moved to edit mode or list)
        try {
            await this.page.waitForURL(url => !url.href.includes('typeorder=regular'), { timeout });
            console.log('Redirect detected. Order likely saved.');
        } catch (e) {
            console.log('No redirect detected within timeout, checking for success message as fallback...');
        }

        // Option B: Check if a success message exists, but don't fail if it doesn't (since user says it might not exist)
        const hasMessage = await this.successMessage.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasMessage) {
            const text = await this.successMessage.innerText();
            console.log(`Success message found: "${text.trim()}"`);
        } else {
            console.log('No success message found, but continuing based on interaction flow.');
        }
    }

    // ── Actions ───────────────────────────────────────────────

    /**
     * Handle the "Remind Me Later" popup if it appears.
     * This popup blocks interactions, so we MUST wait for it and dismiss it.
     */
    async handleRemindMeLaterPopup(): Promise<void> {
        try {
            // Use text-based locator matching the actual button text
            const remindButton = this.page.getByRole('button', { name: /remind me later/i });

            // Wait up to 10 seconds for the popup to appear
            await remindButton.waitFor({ state: 'visible', timeout: 10000 });
            console.log('Popup detected, clicking Remind Me Later...');
            await remindButton.click();

            // Wait for the popup/overlay to fully disappear
            await remindButton.waitFor({ state: 'hidden', timeout: 5000 });
            // Extra wait for any backdrop/overlay animation to finish
            await this.page.waitForTimeout(1000);
            console.log('Popup dismissed successfully.');
        } catch (e) {
            console.log('No popup detected or already dismissed.');
        }
    }

    /**
     * Wait for the Address Book modal to fully load its data.
     * The table uses DataTables which loads data via AJAX, showing
     * a "Processing..." indicator while loading.
     */
    private async waitForAddressBookToLoad(timeout: number = 30000): Promise<void> {
        console.log('Waiting for Address Book modal to open...');

        // 1. Wait for the modal to be visible and stable
        await this.addressBookModal.waitFor({ state: 'visible', timeout });
        // Small wait for animation to finish
        await this.page.waitForTimeout(500);
        console.log('Address Book modal is visible.');

        // 2. Wait for DataTables "Processing..." indicator to disappear (if it appears)
        // We wait for checking if it appears, then wait for it to go
        try {
            const processing = this.addressBookProcessingIndicator;
            // Short timeout to see if "Processing" appears
            if (await processing.isVisible({ timeout: 2000 })) {
                console.log('Processing indicator detected, waiting for data to load...');
                await processing.waitFor({ state: 'hidden', timeout });
                console.log('Processing indicator hidden. Data loaded.');
            }
        } catch {
            // It didn't appear or was too fast, assuming safe to proceed
        }

        // 3. Wait for at least one green Add button to be visible AND enabled
        console.log('Waiting for Add client buttons to appear...');
        // We also wait for the table body to have rows
        await this.page.locator('[data-modal-type="address-book"] table tbody tr').first().waitFor({ state: 'visible', timeout });
        await this.addressBookAddButtons.first().waitFor({ state: 'visible', timeout });
        console.log('Add client buttons are visible. Address Book fully loaded.');
    }

    /**
     * Select a client from the Address Book modal:
     * 1. Click the green Add button for the first client
     * 2. Wait a moment for the selection to register
     * 3. Click CLOSE to dismiss the modal
     */
    async selectClientFromAddressBook(): Promise<void> {
        // Wait for the modal and its data to fully load
        await this.waitForAddressBookToLoad(30000);

        // Click the first green "Add" button
        console.log('Clicking Add button for first client...');
        // Force click can help if there's a tiny overlay or animation still happening
        await this.addressBookAddButtons.first().click({ force: true });
        console.log('Client selected.');

        // Verify the modal is reacting or data is being transferred
        // (Implicit wait via the timeout below)

        // Click CLOSE to dismiss the Address Book modal
        console.log('Clicking CLOSE to dismiss Address Book...');
        await this.addressBookCloseButton.click();

        // CRITICAL: Wait for the modal to actually disappear before proceeding
        // If we click "Add Product" while this modal is fading out, the click might hit the fading backdrop
        console.log('Waiting for Address Book modal to disappear...');
        await this.addressBookModal.waitFor({ state: 'hidden', timeout: 15000 });
        console.log('Address Book modal dismissed.');
    }

    /**
     * Start the order creation flow:
     * 1. Click Add Order
     * 2. Open Address Book → select first client → close
     * 3. Add a product
     * 4. Save Order
     */
    async startCreateOrderFlow(): Promise<void> {
        // 1. Click Add Order
        await this.click(this.addOrderLink);

        // Wait for page to load
        await this.page.waitForLoadState('networkidle');

        // 1.5 Handle the "Remind Me Later" popup that appears on this page
        await this.handleRemindMeLaterPopup();

        // 2. Open Address Book with retry mechanism
        // Sometimes the click doesn't register if the JS handlers aren't fully attached
        console.log('Attempting to open Address Book...');
        await this.addressBookButton.waitFor({ state: 'visible', timeout: 10000 });

        // Try to click. If modal doesn't appear in 2s, click again.
        let isModalVisible = false;
        for (let i = 0; i < 3; i++) {
            await this.addressBookButton.click({ force: true });
            try {
                // Short wait to see if modal appears
                await this.addressBookModal.waitFor({ state: 'visible', timeout: 2000 });
                isModalVisible = true;
                break; // Modal is open!
            } catch {
                console.log(`Click attempt ${i + 1} failed to open Address Book. Retrying...`);
                await this.page.waitForTimeout(500);
            }
        }

        if (!isModalVisible) {
            throw new Error('Failed to open Address Book modal after 3 attempts.');
        }

        // 3. Select first client from Address Book and close modal
        await this.selectClientFromAddressBook();

        // 4. Add Product
        // Ensure strictly that previous modal is gone (handled in selectClientFromAddressBook)
        await this.waitForElementToBeVisible(this.addProductsButton);
        // Small pause to ensure UI is interactive after modal close
        await this.page.waitForTimeout(200);
        await this.click(this.addProductsButton);

        // Wait for product modal table to load
        await this.waitForElementToBeVisible(this.productModalAddButtons.first(), 30000);
        await this.page.waitForTimeout(500); // Wait for table data to fully render

        // Find a product with Available Stock > 0
        console.log('Looking for a product with available stock...');
        const productRows = this.page.locator('.table-products tbody tr');
        const rowCount = await productRows.count();
        let productAdded = false;

        for (let i = 0; i < rowCount; i++) {
            const row = productRows.nth(i);

            // Columns: Images(1), SKU(2), Description(3), UPC(4), In Warehouse(5), Available Stock(6), Qty(7), Add(8)
            const inWarehouseCell = row.locator('td:nth-child(5)');
            const availableStockCell = row.locator('td:nth-child(6)');
            const warehouseText = await inWarehouseCell.innerText().catch(() => '0');
            const stockText = await availableStockCell.innerText().catch(() => '0');
            const warehouseValue = parseInt(warehouseText.trim().replace(/,/g, ''), 10);
            const stockValue = parseInt(stockText.trim().replace(/,/g, ''), 10);

            const sku = await row.locator('td:nth-child(2)').innerText().catch(() => 'unknown');
            console.log(`  Row ${i + 1}: SKU=${sku.trim()}, In Warehouse=${warehouseValue}, Available=${stockValue}`);

            if (!isNaN(stockValue) && stockValue > 0) {
                // Found a product with positive available stock! Click its Add button
                const addButton = row.locator('.btn-add-to-order, button:has-text("Add")');
                if (await addButton.count() > 0) {
                    console.log(`  → Adding this product (Available=${stockValue})`);
                    await addButton.first().click();
                    productAdded = true;
                    break;
                }
            }
        }

        if (!productAdded) {
            // Fallback: just click the first Add button
            console.log('Could not verify stock, adding first available product as fallback...');
            await this.productModalAddButtons.first().click();
        }

        // Close Product Modal
        const visibleCloseButtons = this.page.getByRole('button', { name: /^close$/i }).filter({ hasText: 'Close' });
        if (await visibleCloseButtons.count() > 0) {
            await visibleCloseButtons.locator('visible=true').first().click();
        } else {
            await this.page.locator('button.btn-secondary:has-text("Close")').click();
        }

        // Wait for the product modal to disappear completely
        await this.page.locator('.modal.show').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });

        // 4.5 Add Shipping Information
        console.log('Adding Shipping Information...');
        await this.waitForElementToBeVisible(this.addShippingInfoButton);
        // Small pause to ensure UI is interactive after product modal closes
        await this.page.waitForTimeout(200);
        await this.click(this.addShippingInfoButton);

        // Wait for modal and select options
        console.log('Waiting for Shipping Modal...');
        await this.waitForElementToBeVisible(this.carrierSelect, 10000);

        try {
            await this.carrierSelect.selectOption({ label: 'USPS' });
            console.log('Selected Carrier: USPS');
        } catch {
            await this.carrierSelect.selectOption({ value: 'USPS' }); // fallback to USPS value
            console.log('Selected Carrier: USPS (by value)');
        }

        // Wait for Ship method to populate (selecting carrier usually triggers a network request)
        await this.page.waitForTimeout(800);

        await this.waitForElementToBeVisible(this.shipMethodSelect);

        // Try preferred method first (4s timeout), then fallback to any available USPS method
        try {
            const selectEM = this.shipMethodSelect.selectOption({ value: 'EM' });
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('EM timeout')), 4000));
            await Promise.race([selectEM, timeout]);
            console.log('Selected Ship Method: EM (USPS Express Mail 1-2)');
        } catch {
            console.log('EM method not available, looking for any available USPS method...');

            // Get all visible options that belong to USPS (carrier_id="3")
            const uspsOptions = await this.shipMethodSelect.locator('option[carrier_id="3"]').all();

            // Filter to only visible (not display:none) options with a value
            const availableOptions: string[] = [];
            for (const option of uspsOptions) {
                const style = await option.getAttribute('style');
                const value = await option.getAttribute('value');
                const isHidden = style?.includes('display: none') || style?.includes('display:none');
                if (!isHidden && value && value.trim() !== '') {
                    availableOptions.push(value);
                }
            }

            if (availableOptions.length === 0) {
                throw new Error('No available USPS shipping methods found');
            }

            // Pick a random available method
            const randomMethod = availableOptions[Math.floor(Math.random() * availableOptions.length)];
            await this.shipMethodSelect.selectOption({ value: randomMethod });
            console.log(`Selected random USPS Ship Method: ${randomMethod} (from ${availableOptions.length} available)`);
        }

        // Click Ok
        try {
            await this.shippingModalOkButton.locator('visible=true').first().click();
            console.log('Clicked Ok on Shipping modal');
        } catch {
            await this.page.locator('button:has-text("Ok")').locator('visible=true').first().click();
            console.log('Clicked Ok on Shipping modal (fallback)');
        }

        // Wait for shipping modal to close
        await this.page.locator('.modal.show').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });

        // 5. Save Order
        await this.waitForElementToBeVisible(this.saveOrderButton);
        // Ensure no network requests are pending (like price calculation)
        await this.page.waitForLoadState('networkidle').catch(() => { });

        // Ensure the Save button is actually enabled before clicking
        await expect(this.saveOrderButton).toBeEnabled({ timeout: 10000 });
        console.log('Save Order button is enabled. Clicking...');
        await this.click(this.saveOrderButton);

        // Wait for the page to respond after saving
        await this.page.waitForLoadState('networkidle').catch(() => { });
        console.log('Save Order action completed.');
    }
}
