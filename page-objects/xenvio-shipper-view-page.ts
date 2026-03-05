import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

export class XenvioShipperViewPage extends BasePage {
    // Instead of fixed locators, we build them dynamically or generally
    readonly warehouseDropdown: Locator;
    readonly applicationDropdown: Locator;
    readonly searchInput: Locator;
    readonly searchButton: Locator;

    constructor(page: Page) {
        super(page);

        // Find the mat-form-field components that contain the respective labels
        this.warehouseDropdown = page.locator('mat-form-field').filter({ hasText: 'Warehouse' });
        this.applicationDropdown = page.locator('mat-form-field').filter({ hasText: 'Application' });

        // Search Input y Botón
        this.searchInput = page.getByPlaceholder('Find Shipment');
        this.searchButton = page.locator('button:has-text("Search")');
    }

    /**
     * Selecciona el valor exacto (respetando mayúsculas/minúsculas) de la lista Warehouse.
     * @param warehouseName El valor exacto, ej: "qa18"
     */
    async selectWarehouse(warehouseName: string): Promise<void> {
        console.log(`Selecting Warehouse: ${warehouseName}`);
        await this.waitForElementToBeVisible(this.warehouseDropdown);

        // Abrimos el dropdown
        await this.warehouseDropdown.click();

        // En Angular Material, las opciones <mat-option> aparecen al final del DOM,
        // no dentro del select box, así que las buscamos en la page principal con el texto exato.
        const optionLocator = this.page.locator(`mat-option .mdc-list-item__primary-text`).filter({ hasText: new RegExp(`^${warehouseName}$`) });

        // Esperamos a que la opción esté visible y clickeamos
        await optionLocator.waitFor({ state: 'visible', timeout: 5000 });
        await optionLocator.click();

        // Esperamos brevemente que se cierre el dropdown
        await this.page.waitForTimeout(500);
    }

    /**
     * Selecciona el valor exacto de la lista Application.
     * @param appName El valor exacto, ej: "qa18"
     */
    async selectApplication(appName: string): Promise<void> {
        console.log(`Selecting Application: ${appName}`);
        await this.waitForElementToBeVisible(this.applicationDropdown);

        // Abrimos el dropdown
        await this.applicationDropdown.click();

        // Buscamos la opción exacta en la lista
        const optionLocator = this.page.locator(`mat-option .mdc-list-item__primary-text`).filter({ hasText: new RegExp(`^${appName}$`) });

        await optionLocator.waitFor({ state: 'visible', timeout: 5000 });
        await optionLocator.click();

        await this.page.waitForTimeout(500);
    }

    /**
     * Busca el Shipment usando el ID.
     * @param shipmentId El ID de la orden copiada de ShipEdge.
     */
    async searchShipment(shipmentId: string): Promise<void> {
        console.log(`Searching for Shipment ID: ${shipmentId}`);
        await this.waitForElementToBeVisible(this.searchInput);

        await this.type(this.searchInput, shipmentId);
        await this.click(this.searchButton);

        console.log('Search triggered, waiting for results...');
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000); // Pequeña pausa para que rendericen los resultados
    }
}
