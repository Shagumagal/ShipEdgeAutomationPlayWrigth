import { Locator, Page } from '@playwright/test';
import BasePage from './base-page';

/**
 * Page Object: "Account On Hold" — what a user sees after accepting the invitation, until an admin
 * activates the account (Xenvio creates every user inactive: User#deactivate_user).
 *
 * The screen exists twice and either one may show, depending on where the SSO callback redirects:
 *   - Angular: x5.angular shared/components/inactive-account (/inactive-account) → h1 "Account On Hold"
 *   - Rails:   x5.xenvio app/views/home/inactive_user_index.haml → h2 "User account on hold"
 */
export class XenvioAccountOnHoldPage extends BasePage {

    readonly heading: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.locator('h1, h2').filter({ hasText: /account on hold/i }).first();
    }

    async waitForOnHold(timeoutMs = 60000): Promise<void> {
        await this.waitForElementToBeVisible(this.heading, timeoutMs);
    }
}
