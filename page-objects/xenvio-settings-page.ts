import { Locator, Page, expect } from "@playwright/test";
import BasePage from "../lib/basepage";
import logger from "../lib/logger";

// Initialize logger for this module
const log = logger({ filename: __filename });

/**
 * Xenvio Settings Page Object
 *
 * Handles navigation to Settings via the user avatar dropdown,
 * interacting with the Apps tab, and creating new apps.
 */
export class XenvioSettingsPage extends BasePage {
    // ─── Avatar Dropdown ──────────────────────────────────────
    readonly avatarLink: Locator;
    readonly settingsDropdownItem: Locator;

    // ─── Settings Tabs ────────────────────────────────────────
    readonly appsTab: Locator;

    // ─── Apps Section ─────────────────────────────────────────
    readonly newAppButton: Locator;

    // ─── New App Modal ────────────────────────────────────────
    readonly newAppModal: Locator;
    readonly urlInput: Locator;
    readonly activeCheckbox: Locator;
    readonly createAppButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        super(page);

        // Avatar dropdown - using getByRole for better accessibility-based selection
        this.avatarLink = page.locator('a.nav-link.pr-0.leading-none');
        this.settingsDropdownItem = page.getByRole('link', { name: 'Settings' });

        // Settings page tabs (left sidebar)
        this.appsTab = page.getByRole('link', { name: 'Apps' });

        // Apps section - "New app" button
        this.newAppButton = page.getByRole('link', { name: 'New app' });

        // New App modal
        this.newAppModal = page.locator('#lazybox');
        this.urlInput = page.locator('input[type="text"][name="url"]');
        this.activeCheckbox = page.locator('input#active');
        this.createAppButton = page.getByRole('button', { name: 'Create App' });
        this.cancelButton = page.getByRole('link', { name: 'Cancel' });
    }

    /**
     * Navigate to Settings by clicking the avatar dropdown and then "Settings"
     */
    async navigateToSettings(): Promise<void> {
        log.info('Navigating to Settings via avatar dropdown');
        await this.waitForElementToBeVisible(this.avatarLink);
        await this.click(this.avatarLink);

        log.debug('Clicking "Settings" from dropdown');
        await this.waitForElementToBeVisible(this.settingsDropdownItem);
        await this.click(this.settingsDropdownItem, true);
        await this.waitForURLContains('/settings');
        log.info('Successfully navigated to Settings page');
    }

    /**
     * Click on the "Apps" tab in the Settings sidebar
     */
    async clickAppsTab(): Promise<void> {
        log.info('Clicking "Apps" tab in settings sidebar');
        await this.waitForElementToBeVisible(this.appsTab);
        await this.click(this.appsTab);
        // Wait for the Apps tab pane to become active
        await this.page.locator('#list-apps.tab-pane.active').waitFor({ state: 'visible', timeout: 15000 });
        log.debug('Apps tab section is now active');
    }

    /**
     * Click the "New app" button to open the create app modal
     */
    async clickNewApp(): Promise<void> {
        log.info('Opening New App modal');
        await this.waitForElementToBeVisible(this.newAppButton);
        await this.click(this.newAppButton);
        await this.waitForElementToBeVisible(this.newAppModal, 15000);
        log.debug('New App modal is visible');
    }

    /**
     * Fill the URL input in the New App modal
     */
    async fillUrl(url: string): Promise<void> {
        log.info('Entering webhook URL', { url });
        await this.waitForElementToBeVisible(this.urlInput);
        await this.type(this.urlInput, url);
    }

    /**
     * Build the xenvio webhook URL based on warehouse name
     * Format: https://{warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments
     * @param warehouse The warehouse name from WAREHOUSE_XENVIO env var
     * @returns The full webhook URL
     */
    static buildWebhookUrl(warehouse: string): string {
        return `https://${warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments`;
    }

    /**
     * Select a warehouse checkbox in the New App modal
     * @param warehouseName The name of the warehouse to select
     */
    async selectWarehouse(warehouseName: string): Promise<void> {
        log.info('Selecting warehouse in modal', { warehouse: warehouseName });
        
        // Find label containing the warehouse name
        const warehouseLabel = this.page.locator(`label:has-text("${warehouseName}")`);
        const isLabelVisible = await this.isElementVisible(warehouseLabel, 5000);

        if (isLabelVisible) {
            const checkbox = warehouseLabel.locator('input[type="checkbox"]');
            const isChecked = await checkbox.isChecked();
            if (!isChecked) {
                await warehouseLabel.click();
                log.debug(`Selected warehouse "${warehouseName}"`);
            } else {
                log.debug(`Warehouse "${warehouseName}" was already selected`);
            }
        } else {
            log.warn(`Warehouse label "${warehouseName}" not found in modal!`);
        }
    }

    /**
     * Click the "Create App" button to submit the form
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

    async isAppUrlInTableVisible(url: string): Promise<boolean> {
        return await this.isElementVisible(this.page.locator('td', { hasText: url }).first(), 10000);
    }

    /**
     * Full flow: Create a new app with the specified URL and warehouse
     * @param warehouse The warehouse name (used to build the URL and select warehouse)
     */
    async createApp(warehouse: string): Promise<void> {
        const webhookUrl = XenvioSettingsPage.buildWebhookUrl(warehouse);

        await this.navigateToSettings();
        await this.clickAppsTab();
        await this.clickNewApp();
        await this.fillUrl(webhookUrl);
        await this.selectWarehouse(warehouse);
        await this.clickCreateApp();
    }
}
