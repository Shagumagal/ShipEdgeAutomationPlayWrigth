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
        //
        // IMPORTANT — Positional approach (most resilient):
        // The header has exactly 2 p-select elements in fixed order:
        //   1st p-select  → Facility (warehouse)
        //   2nd p-select  → App
        //
        // We CANNOT rely on hasText(/Facility/) or hasText(/App/) because once
        // a value is selected, the placeholder text disappears and the selected
        // value is shown instead. Positional nth() is the most stable selector.
        //
        // Source: x5.angular/src/app/shipper-view/header/header.component.html
        //   <p-select ... placeholder="Facility" (onChange)="onFacilityChange()">  ← 1st
        //   <p-select ... placeholder="App">                                        ← 2nd

        // 1st p-select in the header search container → Facility
        this.warehouseDropdown = this.page
            .locator('header p-select')
            .nth(0);

        // 2nd p-select in the header search container → App
        // Apps are computed() from selectedWarehouse, populated after onFacilityChange()
        this.applicationDropdown = this.page
            .locator('header p-select')
            .nth(1);

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
     *
     * Uses EXACT match to avoid selecting "Copy of qa20" when "qa20" is requested.
     * Iterates all rendered li options and picks the one whose trimmed text === target.
     *
     * @param warehouseName Exact name, e.g. "qa20"
     * @param timeout Max wait for the dropdown to be ready (default 25s)
     */
    async selectWarehouse(warehouseName: string, timeout = 25000): Promise<void> {
        log.info(`Selecting Warehouse: "${warehouseName}"`);

        // Wait for the 1st p-select (Facility) to be ready
        await this.waitForElementToBeVisible(this.warehouseDropdown, timeout);

        // Open the dropdown overlay
        await this.warehouseDropdown.click();
        await this.page.waitForTimeout(600);

        // Wait for the PrimeNG overlay panel to appear
        const overlay = this.page.locator('.p-select-overlay, .p-dropdown-panel').first();
        await overlay.waitFor({ state: 'visible', timeout: 10000 });

        // Pick the option whose FULL trimmed text matches exactly (case-insensitive)
        // This prevents "Copy of qa20" from being selected when we want "qa20"
        const allOptions = this.page.locator('.p-select-overlay li, .p-select-option, [role="option"]');
        await allOptions.first().waitFor({ state: 'visible', timeout: 10000 });

        const count = await allOptions.count();
        log.info(`  Warehouse overlay has ${count} options — looking for exact "${warehouseName}"`);

        let found = false;
        for (let i = 0; i < count; i++) {
            const opt = allOptions.nth(i);
            const text = (await opt.textContent() ?? '').trim();
            log.debug(`    [${i}] "${text}"`);
            if (text.toLowerCase() === warehouseName.toLowerCase()) {
                log.info(`  ✅ Exact match found at index ${i}: "${text}" — clicking`);
                await opt.click();
                found = true;
                break;
            }
        }

        if (!found) {
            // Fallback: partial match (contains), preferring shortest match
            log.warn(`  ⚠️ No exact match for "${warehouseName}" — trying closest partial match`);
            let bestOpt = null;
            let bestLen = Infinity;
            for (let i = 0; i < count; i++) {
                const opt = allOptions.nth(i);
                const text = (await opt.textContent() ?? '').trim();
                if (text.toLowerCase().includes(warehouseName.toLowerCase()) && text.length < bestLen) {
                    bestOpt = opt;
                    bestLen = text.length;
                    log.debug(`    → Best partial match so far: "${text}" (len=${text.length})`);
                }
            }
            if (bestOpt) {
                const txt = (await bestOpt.textContent() ?? '').trim();
                log.warn(`  ⚠️ Selecting closest partial match: "${txt}"`);
                await bestOpt.click();
            } else {
                throw new Error(`Could not find warehouse option matching "${warehouseName}" in dropdown`);
            }
        }

        // Wait for onFacilityChange() to fire and the App dropdown to repopulate
        await this.page.waitForTimeout(1500);
        log.info(`✅ Warehouse selected: "${warehouseName}"`);
    }

    /**
     * Select an application from the PrimeNG App p-select dropdown.
     *
     * IMPORTANT: Apps are a computed() signal that depends on selectedWarehouse.
     * They only populate AFTER onFacilityChange() fires (triggered by warehouse selection).
     * "Local" (id=0) is always the first option; warehouse apps come after.
     *
     * Uses EXACT match (trimmed, case-insensitive) with a partial-match fallback.
     *
     * @param appName App name to select, e.g. "qa20" or "apprueba1"
     * @param timeout Max wait for the App dropdown options to load (default 20s)
     */
    async selectApplication(appName: string, timeout = 20000): Promise<void> {
        log.info(`Selecting Application: "${appName}"`);

        // The App dropdown is the 2nd p-select in the header.
        // Options are computed() from selectedWarehouse — wait for it to be populated.
        await this.waitForElementToBeVisible(this.applicationDropdown, timeout);

        // Open the App dropdown overlay
        await this.applicationDropdown.click();
        await this.page.waitForTimeout(600);

        // Wait for overlay to appear
        const overlay = this.page.locator('.p-select-overlay, .p-dropdown-panel').first();
        await overlay.waitFor({ state: 'visible', timeout: 10000 });

        // Wait for options to render — at minimum "Local" must be there
        const allOptions = this.page.locator('.p-select-overlay li, .p-select-option, [role="option"]');
        await allOptions.first().waitFor({ state: 'visible', timeout: 10000 });

        // Give Angular time to finish rendering the computed() apps list
        await this.page.waitForTimeout(800);

        const count = await allOptions.count();
        log.info(`  App overlay has ${count} options — looking for exact "${appName}"`);

        let found = false;
        for (let i = 0; i < count; i++) {
            const opt = allOptions.nth(i);
            const text = (await opt.textContent() ?? '').trim();
            log.debug(`    [${i}] "${text}"`);
            if (text.toLowerCase() === appName.toLowerCase()) {
                log.info(`  ✅ Exact match at index ${i}: "${text}" — clicking`);
                await opt.click();
                found = true;
                break;
            }
        }

        if (!found) {
            // Fallback: partial match (contains), preferring the shortest (most specific) match
            log.warn(`  ⚠️ No exact match for "${appName}" — trying closest partial match`);
            let bestOpt = null;
            let bestLen = Infinity;
            for (let i = 0; i < count; i++) {
                const opt = allOptions.nth(i);
                const text = (await opt.textContent() ?? '').trim();
                if (text.toLowerCase().includes(appName.toLowerCase()) && text.length < bestLen) {
                    bestOpt = opt;
                    bestLen = text.length;
                    log.debug(`    → Best partial match so far: "${text}" (len=${text.length})`);
                }
            }
            if (bestOpt) {
                const txt = (await bestOpt.textContent() ?? '').trim();
                log.warn(`  ⚠️ Selecting closest partial match: "${txt}"`);
                await bestOpt.click();
            } else {
                // Log all available options to help debug
                const allTexts: string[] = [];
                for (let i = 0; i < count; i++) {
                    allTexts.push((await allOptions.nth(i).textContent() ?? '').trim());
                }
                log.error(`  ❌ App "${appName}" not found. Available: [${allTexts.join(', ')}]`);
                throw new Error(`Could not find app option matching "${appName}". Available: [${allTexts.join(', ')}]`);
            }
        }

        await this.page.waitForTimeout(500);
        log.info(`✅ Application selected: "${appName}"`);
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
