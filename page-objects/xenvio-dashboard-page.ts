import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

export class XenvioDashboardPage extends BasePage {
    readonly shipperViewLink: Locator;

    constructor(page: Page) {
        super(page);
        this.shipperViewLink = page.locator('a.nav-link:has-text("Shipper View")');
    }

    /**
     * Click the "Shipper View" link which opens in a new tab.
     * @returns A promise that resolves to the new Page (popup)
     */
    async openShipperView(): Promise<Page> {
        console.log('Clicking "Shipper View" link...');
        await this.waitForElementToBeVisible(this.shipperViewLink);

        // Wait for the popup page to be created
        const popupPromise = this.page.waitForEvent('popup');
        await this.shipperViewLink.click();
        const popupPage = await popupPromise;

        // Wait for the new page to load
        await popupPage.waitForLoadState('networkidle');
        return popupPage;
    }
}
