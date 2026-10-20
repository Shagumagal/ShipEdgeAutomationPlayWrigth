import { Locator, Page } from '@playwright/test';
import BasePage from '../base-page';

/**
 * Component: the gear (Configuration) menu of the Shipper View header (v2).
 * Source: x5.angular src/app/layout/header/header.component.{ts,html} → p-popover #configMenu,
 * one button per item of configList (filtered by the user's role).
 *
 * Items are found by their PrimeIcons class, which does not change with the UI language.
 */
export class XenvioConfigMenu extends BasePage {

    readonly gearButton: Locator;
    readonly popover: Locator;

    constructor(page: Page) {
        super(page);
        this.gearButton = page.locator('p-button[ptooltip="Configuration"]')
            .or(page.locator('p-button').filter({ has: page.locator('.pi-cog') }))
            .first();
        this.popover = page.locator('.p-popover');
    }

    /** Opens the menu and clicks the item with icon `pi-<icon>`, e.g. 'users' → "Users". */
    async open(icon: string): Promise<void> {
        const item = this.popover.locator('button').filter({ has: this.page.locator(`i.pi-${icon}`) });
        await this.waitForElementToBeVisible(this.gearButton, 15000);
        await this.click(this.gearButton);

        if (!(await this.isElementVisible(item, 5000))) {
            const items = await this.popover.locator('button').allInnerTexts();
            throw new Error(`The Configuration menu has no "pi-${icon}" item for this user. Items: ${items.map((text) => text.trim()).join(', ') || 'none'}`);
        }
        await this.click(item);
    }
}
