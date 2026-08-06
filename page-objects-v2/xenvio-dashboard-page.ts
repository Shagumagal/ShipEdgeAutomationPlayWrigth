import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Xenvio Dashboard Page Object (v2)
 * 
 * Dashboard link to Shipper View is unchanged.
 */
export class XenvioDashboardPage extends BasePage {
    readonly shipperViewLink: Locator;

    constructor(page: Page) {
        super(page);
        this.shipperViewLink = page.locator('a.nav-link:has-text("Shipper View")');
    }

    /**
     * Click "Shipper View" link which opens in a new tab.
     * @returns The new popup Page
     */
    async openShipperView(): Promise<Page> {
        console.log('Clicking "Shipper View" link...');
        await this.waitForElementToBeVisible(this.shipperViewLink);

        const popupPromise = this.page.waitForEvent('popup');
        await this.shipperViewLink.click();
        const popupPage = await popupPromise;

        await popupPage.waitForLoadState('networkidle');
        // Wait for Angular + PrimeNG to finish bootstrapping the p-select components
        await popupPage.locator('p-select').first().waitFor({ state: 'visible', timeout: 30000 });

        return popupPage;
    }
}
