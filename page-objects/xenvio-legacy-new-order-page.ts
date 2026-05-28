import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";
import logger from "../lib/logger";

const log = logger({ filename: __filename });

/**
 * Xenvio Legacy New Order Page Object
 *
 * Handles the full order creation flow in the legacy ShipEdge Rails UI:
 * Orders → New Order → Fill Header → Fill Recipient → Create Shipment
 */
export class XenvioLegacyNewOrderPage extends BasePage {

    // ── Navigation ────────────────────────────────────────────
    readonly ordersMenuLink: Locator;
    readonly newOrderLink: Locator;

    // ── Order Header Form ─────────────────────────────────────
    readonly warehouseSelect: Locator;
    readonly storeSelect: Locator;
    readonly orderNumberInput: Locator;
    readonly sameAsWarehouseCheckbox: Locator;
    readonly shipFromPhoneInput: Locator;
    readonly createOrderButton: Locator;

    // ── Recipient Form (Step 2) ───────────────────────────────
    readonly recipientNameInput: Locator;

    // ── Shipment Form ─────────────────────────────────────────
    readonly shipmentNumberInput: Locator;
    readonly shipMethodSelect: Locator;

    // ── Ship-To Address ───────────────────────────────────────
    readonly shipToAddress1Input: Locator;
    readonly shipToZipInput: Locator;
    readonly shipToStateInput: Locator;
    readonly shipToCityInput: Locator;
    readonly shipToCompanyInput: Locator;
    readonly shipToNameInput: Locator;
    readonly shipToPhoneInput: Locator;
    readonly shipToEmailInput: Locator;

    // ── Final Action ──────────────────────────────────────────
    readonly createShipmentButton: Locator;

    constructor(page: Page) {
        super(page);

        // Navigation
        this.ordersMenuLink = page.getByRole('link', { name: ' Orders' });
        this.newOrderLink = page.getByRole('link', { name: 'New order' });

        // Order Header
        this.warehouseSelect = page.getByLabel('Warehouse', { exact: true });
        this.storeSelect = page.getByLabel('Store');
        this.orderNumberInput = page.getByRole('textbox', { name: 'Order number' });
        this.sameAsWarehouseCheckbox = page.getByText('Same as warehouse');
        this.shipFromPhoneInput = page.getByRole('textbox', { name: 'Phone' }).first();
        this.createOrderButton = page.getByRole('button', { name: 'Create Order' });

        // Recipient (Step 2 after first Create Order click)
        this.recipientNameInput = page.getByRole('textbox', { name: 'Name' }).first();

        // Shipment
        this.shipmentNumberInput = page.getByRole('textbox', { name: 'Shipment number *' });
        // The label contains the warehouse name dynamically; we target by role (combobox) with regex
        this.shipMethodSelect = page.getByRole('combobox', { name: /Custom shipping method/i }).first();

        // Ship-To Address fields
        this.shipToAddress1Input = page.getByRole('textbox', { name: 'Address1' });
        this.shipToZipInput = page.getByRole('textbox', { name: 'Zip' });
        this.shipToStateInput = page.getByRole('textbox', { name: 'State' });
        this.shipToCityInput = page.getByRole('textbox', { name: 'City' });
        this.shipToCompanyInput = page.getByRole('textbox', { name: 'Company' });
        this.shipToNameInput = page.getByRole('textbox', { name: 'Name' }).nth(1);
        this.shipToPhoneInput = page.getByRole('textbox', { name: 'Phone' }).nth(1);
        this.shipToEmailInput = page.getByRole('textbox', { name: 'Email' });

        // Submit shipment
        this.createShipmentButton = page.getByRole('button', { name: 'Create Shipment' });
    }

    // ── Navigation Actions ────────────────────────────────────

    /** Click "Orders" in the sidebar menu */
    async navigateToOrders(): Promise<void> {
        log.info('Clicking "Orders" menu link');
        await this.waitForElementToBeVisible(this.ordersMenuLink);
        await this.click(this.ordersMenuLink);
        await this.page.waitForLoadState('domcontentloaded');
        log.info('Navigated to Orders section');
    }

    /** Click "New order" */
    async clickNewOrder(): Promise<void> {
        log.info('Clicking "New order" link');
        await this.waitForElementToBeVisible(this.newOrderLink);
        await this.click(this.newOrderLink);
        await this.page.waitForLoadState('domcontentloaded');
        log.info('Navigated to New Order form');
    }

    // ── Order Header ──────────────────────────────────────────

    /**
     * Select Warehouse by option value
     * @param warehouseId - e.g. '141'
     */
    async selectWarehouse(warehouseId: string): Promise<void> {
        log.info('Selecting warehouse', { warehouseId });
        await this.waitForElementToBeVisible(this.warehouseSelect);
        await this.warehouseSelect.selectOption(warehouseId);
        log.info('Warehouse selected', { warehouseId });
    }

    /**
     * Select Store — picks the first available non-empty option
     * @param storeId - optional specific store ID (e.g. '8'). If omitted, picks first available.
     */
    async selectStore(storeId?: string): Promise<void> {
        await this.waitForElementToBeVisible(this.storeSelect);
        if (storeId) {
            log.info('Selecting store by ID', { storeId });
            await this.storeSelect.selectOption(storeId);
        } else {
            // Pick first non-empty option
            const options = await this.storeSelect.locator('option').all();
            for (const option of options) {
                const val = await option.getAttribute('value');
                if (val && val.trim() !== '') {
                    await this.storeSelect.selectOption(val);
                    log.info('Selected first available store', { storeId: val });
                    break;
                }
            }
        }
    }

    /** Fill Order Number field */
    async fillOrderNumber(orderNumber: string): Promise<void> {
        log.info('Filling order number', { orderNumber });
        await this.waitForElementToBeVisible(this.orderNumberInput);
        await this.type(this.orderNumberInput, orderNumber);
    }

    /** Click "Same as warehouse" for ship-from address */
    async clickSameAsWarehouse(): Promise<void> {
        log.info('Clicking "Same as warehouse"');
        await this.waitForElementToBeVisible(this.sameAsWarehouseCheckbox);
        await this.click(this.sameAsWarehouseCheckbox);
    }

    /** Fill Ship-From phone number */
    async fillShipFromPhone(phone: string): Promise<void> {
        log.info('Filling ship-from phone', { phone });
        await this.waitForElementToBeVisible(this.shipFromPhoneInput);
        await this.type(this.shipFromPhoneInput, phone);
    }

    /** Click "Create Order" button */
    async clickCreateOrder(): Promise<void> {
        log.info('Clicking "Create Order" button');
        await this.waitForElementToBeVisible(this.createOrderButton);
        await this.click(this.createOrderButton);
        await this.page.waitForLoadState('domcontentloaded');
    }

    // ── Recipient ─────────────────────────────────────────────

    /** Fill recipient name (Step 2 validation) */
    async fillRecipientName(name: string): Promise<void> {
        log.info('Filling recipient name', { name });
        await this.waitForElementToBeVisible(this.recipientNameInput);
        await this.page.waitForTimeout(500); // Wait to prevent typing too fast
        await this.type(this.recipientNameInput, name);
    }

    // ── Shipment ──────────────────────────────────────────────

    /** Fill the Shipment Number field */
    async fillShipmentNumber(shipmentNumber: string): Promise<void> {
        log.info('Waiting for shipment form to render...');
        await this.page.waitForTimeout(3000); // Wait after order creation before filling shipment
        log.info('Filling shipment number', { shipmentNumber });
        await this.waitForElementToBeVisible(this.shipmentNumberInput);
        await this.type(this.shipmentNumberInput, shipmentNumber);
    }

    /**
     * Select shipping method by its option value (numeric ID)
     * @param shipMethodId - e.g. '7948'
     */
    async selectShipMethod(shipMethodId: string): Promise<void> {
        log.info('Selecting shipping method', { shipMethodId });
        await this.waitForElementToBeVisible(this.shipMethodSelect);
        await this.shipMethodSelect.selectOption(shipMethodId);
        log.info('Shipping method selected', { shipMethodId });
    }

    // ── Ship-To Address ───────────────────────────────────────

    /**
     * Fill all Ship-To address fields
     */
    async fillShipToAddress(params: {
        address1: string;
        zip: string;
        state: string;
        city: string;
        company: string;
        name: string;
        phone: string;
        email: string;
    }): Promise<void> {
        log.info('Filling Ship-To address fields');
        await this.page.waitForTimeout(500); // Give the form time to settle
        await this.type(this.shipToAddress1Input, params.address1);
        await this.page.waitForTimeout(200);
        await this.type(this.shipToZipInput, params.zip);
        await this.page.waitForTimeout(200);
        await this.type(this.shipToStateInput, params.state);
        await this.type(this.shipToCityInput, params.city);
        await this.type(this.shipToCompanyInput, params.company);
        await this.type(this.shipToNameInput, params.name);
        await this.type(this.shipToPhoneInput, params.phone);
        await this.type(this.shipToEmailInput, params.email);
        log.info('Ship-To address filled', params);
    }

    /** Click "Create Shipment" to finalize */
    async clickCreateShipment(): Promise<void> {
        log.info('Clicking "Create Shipment" button');
        await this.waitForElementToBeVisible(this.createShipmentButton);
        await this.click(this.createShipmentButton);
        await this.page.waitForLoadState('domcontentloaded');
        log.info('Create Shipment submitted');
    }

    // ── Capture IDs ───────────────────────────────────────────

    /**
     * Capture the Order ID from the page after creation.
     * Looks for a pattern like "OrdersPending50440" or "Orders...50440" in the DOM text,
     * or falls back to extracting from the current URL.
     * @returns Order ID as string, or null if not found
     */
    async captureOrderId(): Promise<string | null> {
        log.info('Attempting to capture Order ID from page');

        // Strategy 1: Look for element with text matching "Orders" + digits (e.g. "OrdersPending50440")
        try {
            const orderPattern = /Orders\D*(\d{4,6})/i;
            const allText = await this.page.locator('body').innerText();
            const match = allText.match(orderPattern);
            if (match?.[1]) {
                log.info('Order ID captured from body text', { orderId: match[1] });
                return match[1];
            }
        } catch (e) {
            log.warn('Strategy 1 for Order ID failed', { error: String(e) });
        }

        // Strategy 2: Extract from URL parameter
        const urlMatch = this.page.url().match(/[?&](?:order_id|id)=(\d+)/);
        if (urlMatch?.[1]) {
            log.info('Order ID captured from URL', { orderId: urlMatch[1] });
            return urlMatch[1];
        }

        // Strategy 3: Look for clickable element with text containing only digits (4-6)
        try {
            const candidates = this.page.locator('text=/^\\d{4,6}$/');
            const count = await candidates.count();
            if (count > 0) {
                const text = await candidates.first().innerText();
                log.info('Order ID captured from digit-only element', { orderId: text.trim() });
                return text.trim();
            }
        } catch (e) {
            log.warn('Strategy 3 for Order ID failed', { error: String(e) });
        }

        log.warn('Could not capture Order ID');
        return null;
    }

    /**
     * Capture the Shipment ID from the page after creation.
     * Looks for "Shipment XXXXX" pattern in the page text.
     * @returns Shipment ID as string, or null if not found
     */
    async captureShipmentId(): Promise<string | null> {
        log.info('Attempting to capture Shipment ID from page');

        // Strategy 1: "Shipment 50255" pattern in DOM text
        try {
            const allText = await this.page.locator('body').innerText();
            const match = allText.match(/Shipment\s+(\d{4,6})/i);
            if (match?.[1]) {
                log.info('Shipment ID captured from body text', { shipmentId: match[1] });
                return match[1];
            }
        } catch (e) {
            log.warn('Strategy 1 for Shipment ID failed', { error: String(e) });
        }

        // Strategy 2: From URL
        const urlMatch = this.page.url().match(/[?&]shipment_id=(\d+)/);
        if (urlMatch?.[1]) {
            log.info('Shipment ID captured from URL', { shipmentId: urlMatch[1] });
            return urlMatch[1];
        }

        log.warn('Could not capture Shipment ID');
        return null;
    }
}
