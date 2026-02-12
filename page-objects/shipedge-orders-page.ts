import { Locator, Page } from "@playwright/test";
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
        
        // Save Order Button - using pdf="false" to target only "Save Order" (not "Save & Download PDF")
        this.saveOrderButton = page.locator('.btn-save-order[pdf="false"]');

        // -- List/Other --
        this.ordersTable = page.locator('table');
        this.successMessage = page.locator('.alert-success');
    }

    // ── Actions ───────────────────────────────────────────────

    /**
     * Handle the "Remind Me Later" popup if it appears
     */
    async handleRemindMeLaterPopup(): Promise<void> {
        try {
            if (await this.remindMeLaterButton.isVisible({ timeout: 5000 })) {
                console.log('Popup detected, clicking Remind Me Later...');
                await this.click(this.remindMeLaterButton);
            }
        } catch (e) {
            console.log('No popup detected or error handling it.');
        }
    }

    /**
     * Wait for the Address Book modal to fully load its client data.
     * The table uses DataTables which loads data via AJAX, showing
     * a "Processing..." indicator while loading.
     */
    private async waitForAddressBookToLoad(timeout: number = 30000): Promise<void> {
        console.log('Waiting for Address Book modal to open...');
        
        // 1. Wait for the modal to be visible
        await this.addressBookModal.waitFor({ state: 'visible', timeout });
        console.log('Address Book modal is visible.');

        // 2. Wait for DataTables "Processing..." indicator to disappear (if it appears)
        try {
            await this.page.waitForTimeout(500);
            
            if (await this.addressBookProcessingIndicator.isVisible({ timeout: 2000 })) {
                console.log('Processing indicator detected, waiting for data to load...');
                await this.addressBookProcessingIndicator.waitFor({ state: 'hidden', timeout });
                console.log('Processing indicator hidden. Data loaded.');
            }
        } catch {
            console.log('No processing indicator found or it already disappeared.');
        }

        // 3. Wait for at least one green Add button to be visible in the table
        console.log('Waiting for Add client buttons to appear...');
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
        await this.addressBookAddButtons.first().click();
        console.log('Client selected.');

        // Small wait for the client data to populate the order form
        await this.page.waitForTimeout(1000);

        // Click CLOSE to dismiss the Address Book modal
        console.log('Clicking CLOSE to dismiss Address Book...');
        await this.addressBookCloseButton.click();
        console.log('Address Book closed.');

        // Wait for the modal to fully close
        await this.addressBookModal.waitFor({ state: 'hidden', timeout: 10000 });
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
        
        // 2. Open Address Book
        await this.waitForElementToBeVisible(this.addressBookButton);
        await this.click(this.addressBookButton);
        
        // 3. Select first client from Address Book and close modal
        await this.selectClientFromAddressBook();
        
        // 4. Add Product
        await this.waitForElementToBeVisible(this.addProductsButton);
        await this.click(this.addProductsButton);
        
        // Wait for product modal and add first product
        await this.waitForElementToBeVisible(this.productModalAddButtons.first(), 30000);
        await this.click(this.productModalAddButtons.first());
        
        // Close Product Modal
        const visibleCloseButtons = this.page.getByRole('button', { name: /^close$/i }).filter({ hasText: 'Close' });
        if (await visibleCloseButtons.count() > 0) {
             await visibleCloseButtons.locator('visible=true').first().click();
        } else {
             await this.page.locator('button.btn-secondary:has-text("Close")').click();
        }

        // 5. Save Order
        await this.page.waitForTimeout(500);
        await this.waitForElementToBeVisible(this.saveOrderButton);
        await this.click(this.saveOrderButton);
    }
}
