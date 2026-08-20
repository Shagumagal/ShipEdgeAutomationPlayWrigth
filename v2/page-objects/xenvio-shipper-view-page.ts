import { Locator, Page } from "@playwright/test";
import BasePage from "../../lib/basepage";
import logger from "../../lib/logger";

const log = logger({ filename: __filename });

/**
 * Xenvio Shipper View Page Object (v2 — PrimeNG)
 *
 * Header now uses:
 *   - p-select for Warehouse (Facility) and Application (App)
 *   - pInputText for shipment search
 *   - p-button for Search and New Order
 */
export class XenvioShipperViewPage extends BasePage {

    // ─── Top Navigation (Shipment Search) ─────────────────────
    warehouseDropdown!: Locator;
    applicationDropdown!: Locator;
    searchInput!: Locator;
    searchButton!: Locator;

    // ─── Top Navigation (Configuration Menu) ──────────────────
    configMenuButton!: Locator;
    appsMenuItem!: Locator;

    // ─── Apps List Page ───────────────────────────────────────
    newAppButton!: Locator;
    newAppModal!: Locator;
    nameInput!: Locator;
    createAppButton!: Locator;
    cancelButton!: Locator;

    constructor(page: Page) {
        super(page);
        this.initLocators();
    }

    setPage(newPage: Page) {
        this.page = newPage;
        this.initLocators();
    }

    private initLocators() {
        // ─── PrimeNG Header Selectors ───────────────────────────
        // Facility dropdown: <p-select placeholder="Facility">
        this.warehouseDropdown = this.page.locator('p-select').filter({ hasText: /Facility/i }).first();

        // App dropdown: <p-select placeholder="App">
        this.applicationDropdown = this.page.locator('p-select').filter({ hasText: /App/i }).first();

        // Search input: <input pInputText placeholder="ID">
        this.searchInput = this.page.locator('input[pInputText]').first();

        // Search button: <p-button label="Search">
        this.searchButton = this.page.locator('p-button, button').filter({ hasText: /^Search$/i }).first();

        // ─── Configuration Menu ──────────────────────────────────
        this.configMenuButton = this.page.locator('button[mattooltip="Configuration"], button:has(i.pi-cog)').first();
        this.appsMenuItem = this.page.locator('button[mat-menu-item] span, a, li').filter({ hasText: 'Apps' }).first();

        // ─── Apps Page & Modal ───────────────────────────────────
        this.newAppButton = this.page.getByRole('button', { name: 'New app' });
        this.newAppModal = this.page.locator('app-apps-form div[role="dialog"], .p-dialog').first();
        this.nameInput = this.page.locator('input#appName');
        this.createAppButton = this.page.getByRole('button', { name: 'Create App' });
        this.cancelButton = this.page.getByRole('button', { name: 'Cancel' });
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 1 — Shipment Search (PrimeNG p-select)
    // ══════════════════════════════════════════════════════════════

    /**
     * Select a warehouse/facility from the PrimeNG p-select dropdown.
     * @param warehouseName Exact match, e.g. "qa20"
     */
    async selectWarehouse(warehouseName: string): Promise<void> {
        log.debug(`Selecting Warehouse: ${warehouseName}`);
        // Angular needs time to initialize p-select after popup opens → 20s timeout
        await this.selectPrimeNGDropdown(this.warehouseDropdown, warehouseName, 20000);
        await this.page.waitForTimeout(500);
        log.debug(`✅ Warehouse selected: ${warehouseName}`);
    }

    /**
     * Select an application from the PrimeNG p-select dropdown.
     * @param appName Exact match, e.g. "qa20"
     */
    async selectApplication(appName: string): Promise<void> {
        log.debug(`Selecting Application: ${appName}`);
        // Wait for the app dropdown options to populate after warehouse selection
        await this.page.waitForTimeout(2000);
        await this.selectPrimeNGDropdown(this.applicationDropdown, appName, 20000);
        await this.page.waitForTimeout(500);
        log.debug(`✅ Application selected: ${appName}`);
    }

    /**
     * Search for a shipment by ID using the PrimeNG header.
     */
    async searchShipment(shipmentId: string): Promise<void> {
        log.info(`Searching for Shipment ID: ${shipmentId}`);
        await this.waitForElementToBeVisible(this.searchInput);
        await this.type(this.searchInput, shipmentId);
        await this.click(this.searchButton);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 2 — App Creation
    // ══════════════════════════════════════════════════════════════

    async openConfigMenu(): Promise<void> {
        log.info('Opening Configuration menu');
        await this.waitForElementToBeVisible(this.configMenuButton);
        await this.click(this.configMenuButton);
    }

    async clickAppsMenuItem(): Promise<void> {
        log.info('Clicking "Apps" menu item');
        await this.waitForElementToBeVisible(this.appsMenuItem);
        await this.click(this.appsMenuItem, true);
        await this.waitForURLContains('/apps');
    }

    async clickNewApp(): Promise<void> {
        log.info('Opening New App modal');
        await this.waitForElementToBeVisible(this.newAppButton);
        await this.click(this.newAppButton);
        await this.waitForElementToBeVisible(this.newAppModal, 15000);
    }

    async fillName(name: string): Promise<void> {
        log.info('Entering app name', { name });
        await this.waitForElementToBeVisible(this.nameInput);
        await this.nameInput.click();
        await this.nameInput.fill('');
        await this.nameInput.pressSequentially(name, { delay: 30 });
        await this.nameInput.dispatchEvent('input');
        await this.nameInput.dispatchEvent('change');
        await this.nameInput.dispatchEvent('blur');
    }

    async selectFacilityAndFillUrl(warehouseName: string, url: string): Promise<void> {
        log.info('Selecting facility and filling URL', { warehouse: warehouseName, url });

        const facilityRow = this.page.locator('div.space-y-2').filter({
            has: this.page.locator('label').filter({
                hasText: new RegExp(`^\\s*${warehouseName}\\s*$`)
            })
        });

        const isRowVisible = await this.isElementVisible(facilityRow.first(), 8000);
        if (!isRowVisible) {
            throw new Error(`CRITICAL: Facility "${warehouseName}" NOT FOUND.`);
        }

        const label = facilityRow.first().locator('label');
        const checkbox = facilityRow.first().locator('input[type="checkbox"]');

        if (!(await checkbox.isChecked())) {
            await label.click();
        }

        const urlInput = facilityRow.first().locator('input[type="text"]');
        await this.waitForElementToBeVisible(urlInput, 5000);
        await urlInput.click();
        await urlInput.fill(url);
        await urlInput.dispatchEvent('input');
        await urlInput.dispatchEvent('change');
        await urlInput.dispatchEvent('blur');
    }

    async clickCreateApp(): Promise<void> {
        log.info('Submitting New App form');
        await this.waitForElementToBeVisible(this.createAppButton);
        await this.click(this.createAppButton, true);
    }

    async isNewAppModalVisible(): Promise<boolean> {
        return await this.isElementVisible(this.newAppModal);
    }

    async isAppNameInTableVisible(appName: string): Promise<boolean> {
        return await this.isElementVisible(
            this.page.locator('td, div', { hasText: appName }).first(),
            10000
        );
    }

    static generateAppName(warehouse: string): string {
        const suffix = Math.floor(Math.random() * 9000 + 1000).toString(16).slice(0, 4);
        return `App${warehouse}${suffix}`;
    }

    static buildWebhookUrl(warehouse: string): string {
        return `https://${warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments`;
    }
}
