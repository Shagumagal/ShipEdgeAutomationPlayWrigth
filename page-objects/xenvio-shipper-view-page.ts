import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";
import logger from "../lib/logger";

// Initialize logger for this module
const log = logger({ filename: __filename });

/**
 * Xenvio Shipper View Page Object
 *
 * Handles the Angular-based Shipper View application:
 *   https://x5demo1angular.shipedge.com/shipper-view
 *
 * ─── Two Responsibilities ────────────────────────────────────────
 * 1. Shipment search (existing functionality)
 * 2. App creation via Configuration → Apps → New App (new functionality)
 *
 * ─── Key difference from Legacy flow ────────────────────────────────────────
 * In the Shipper View modal, selecting a warehouse/facility checkbox
 * ENABLES a URL input per row. The URL must be filled AFTER the checkbox.
 *
 * This Page Object is designed to work on the popup Page returned by
 * XenvioDashboardPage.openShipperView().
 */
export class XenvioShipperViewPage extends BasePage {

    // ─── Top Navigation (Shipment Search) ─────────────────────
    readonly warehouseDropdown: Locator;
    readonly applicationDropdown: Locator;
    readonly searchInput: Locator;
    readonly searchButton: Locator;

    // ─── Top Navigation (Configuration Menu) ──────────────────
    readonly configMenuButton: Locator;

    // ─── Configuration Dropdown ───────────────────────────────
    readonly appsMenuItem: Locator;

    // ─── Apps List Page ───────────────────────────────────────
    readonly newAppButton: Locator;

    // ─── New App Modal ────────────────────────────────────────
    readonly newAppModal: Locator;
    readonly nameInput: Locator;
    readonly createAppButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        super(page);

        // ─── Shipment Search ─────────────────────────────────────
        this.warehouseDropdown = page.locator('mat-form-field').filter({ hasText: 'Warehouse' });
        this.applicationDropdown = page.locator('mat-form-field').filter({ hasText: 'Application' });
        this.searchInput = page.getByPlaceholder('Find Shipment');
        this.searchButton = page.locator('button:has-text("Search")');

        // ─── Configuration Menu ──────────────────────────────────
        // The gear/grid icon button with tooltip "Configuration"
        this.configMenuButton = page.locator('button[mattooltip="Configuration"]');

        // "Apps" item inside the Angular Material menu
        this.appsMenuItem = page.locator('button[mat-menu-item] span.mat-mdc-menu-item-text', {
            hasText: 'Apps'
        });

        // ─── Apps Page & Modal ───────────────────────────────────
        this.newAppButton = page.getByRole('button', { name: 'New app' });
        this.newAppModal = page.locator('app-apps-form');
        this.nameInput = page.locator('input#appName');
        this.createAppButton = page.getByRole('button', { name: 'Create App' });
        this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 1 — Shipment Search (existing methods)
    // ══════════════════════════════════════════════════════════════

    /**
     * Selecciona el valor exacto de la lista Warehouse.
     * @param warehouseName El valor exacto, ej: "qa18"
     */
    async selectWarehouse(warehouseName: string): Promise<void> {
        log.debug(`Selecting Warehouse: ${warehouseName}`);
        await this.waitForElementToBeVisible(this.warehouseDropdown);
        await this.warehouseDropdown.click();

        const optionLocator = this.page.locator(`mat-option .mdc-list-item__primary-text`).filter({
            hasText: new RegExp(`^${warehouseName}$`)
        });
        await optionLocator.waitFor({ state: 'visible', timeout: 5000 });
        await optionLocator.click();
        await this.page.waitForTimeout(500);
    }

    /**
     * Selecciona el valor exacto de la lista Application.
     * @param appName El valor exacto, ej: "qa18"
     */
    async selectApplication(appName: string): Promise<void> {
        log.debug(`Selecting Application: ${appName}`);
        await this.waitForElementToBeVisible(this.applicationDropdown);
        await this.applicationDropdown.click();

        const optionLocator = this.page.locator(`mat-option .mdc-list-item__primary-text`).filter({
            hasText: new RegExp(`^${appName}$`)
        });
        await optionLocator.waitFor({ state: 'visible', timeout: 5000 });
        await optionLocator.click();
        await this.page.waitForTimeout(500);
    }

    /**
     * Busca el Shipment usando el ID.
     * @param shipmentId El ID de la orden copiada de ShipEdge.
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
    // SECTION 2 — App Creation (new methods)
    // ══════════════════════════════════════════════════════════════

    /**
     * Click the "Configuration" button to open the navigation menu.
     */
    async openConfigMenu(): Promise<void> {
        log.info('Opening Configuration menu in Shipper View');
        await this.waitForElementToBeVisible(this.configMenuButton);
        await this.click(this.configMenuButton);
        log.debug('Configuration menu opened');
    }

    /**
     * Click the "Apps" item from the Configuration dropdown menu.
     * Navigates to /apps.
     */
    async clickAppsMenuItem(): Promise<void> {
        log.info('Clicking "Apps" menu item');
        await this.waitForElementToBeVisible(this.appsMenuItem);
        await this.click(this.appsMenuItem, true);
        await this.waitForURLContains('/apps');
        log.info('Navigated to Apps page');
    }

    /**
     * Click the "New app" button to open the creation modal.
     */
    async clickNewApp(): Promise<void> {
        log.info('Opening New App modal');
        await this.waitForElementToBeVisible(this.newAppButton);
        await this.click(this.newAppButton);
        await this.waitForElementToBeVisible(this.newAppModal, 15000);
        log.debug('New App modal is visible');
    }

    /**
     * Fill the Name field in the New App modal.
     * @param name The app name to enter
     */
    async fillName(name: string): Promise<void> {
        log.info('Entering app name', { name });
        await this.waitForElementToBeVisible(this.nameInput);
        await this.type(this.nameInput, name);
    }

    /**
     * Select a warehouse/facility by exact name, then fill its URL input.
     *
     * In the Shipper View modal, each facility row contains:
     *   [checkbox] [label: "qa20"]
     *   [url input — enabled only after checkbox is checked]
     *
     * Matching uses an exact regex to avoid selecting "qa20-1" or "qa20-Prueba".
     *
     * @param warehouseName Exact label text (e.g. 'qa20')
     * @param url The webhook URL to fill for that facility
     */
    async selectFacilityAndFillUrl(warehouseName: string, url: string): Promise<void> {
        log.info('Selecting facility and filling URL', { warehouse: warehouseName, url });

        // Each facility row is a div.space-y-2 containing a label that matches exactly
        const facilityRow = this.page.locator('div.space-y-2').filter({
            has: this.page.locator('label').filter({
                hasText: new RegExp(`^${warehouseName}$`)
            })
        });

        const isRowVisible = await this.isElementVisible(facilityRow.first(), 8000);
        if (!isRowVisible) {
            log.warn(`Facility "${warehouseName}" not found in modal — check the exact label text!`);
            return;
        }

        // Step 1: Click the checkbox to enable the URL input
        const checkbox = facilityRow.first().locator('input[type="checkbox"]');
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
            await checkbox.click();
            log.debug(`Checked facility "${warehouseName}"`);
        } else {
            log.debug(`Facility "${warehouseName}" was already checked`);
        }

        // Step 2: Wait for the URL input to appear/become enabled, then fill it
        const urlInput = facilityRow.first().locator('input[type="text"]');
        await this.waitForElementToBeVisible(urlInput, 5000);
        await this.type(urlInput, url);
        log.debug(`URL filled for facility "${warehouseName}"`);
    }

    /**
     * Submit the New App form by clicking "Create App".
     */
    async clickCreateApp(): Promise<void> {
        log.info('Submitting New App form');
        await this.waitForElementToBeVisible(this.createAppButton);
        await this.click(this.createAppButton, true);
        log.info('New App form submitted');
    }

    // ─── Visibility Check Methods ─────────────────────────────

    async isNewAppModalVisible(): Promise<boolean> {
        return await this.isElementVisible(this.newAppModal);
    }

    async isAppNameInTableVisible(appName: string): Promise<boolean> {
        return await this.isElementVisible(
            this.page.locator('td, div', { hasText: appName }).first(),
            10000
        );
    }

    // ─── Static Helpers ───────────────────────────────────────

    /**
     * Generate a unique app name to avoid duplicates.
     * Format: App + {warehouse} + {4 hex chars}
     * Example: Appqa20a3f1
     */
    static generateAppName(warehouse: string): string {
        const suffix = Math.floor(Math.random() * 9000 + 1000).toString(16).slice(0, 4);
        return `App${warehouse}${suffix}`;
    }

    /**
     * Build the Xenvio webhook URL for a given warehouse.
     * Format: https://{warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments
     */
    static buildWebhookUrl(warehouse: string): string {
        return `https://${warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments`;
    }
}
