import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Xenvio Login Page Object (v2)
 * 
 * Login flow hasn't changed — same selectors apply.
 */
export class XenvioLoginPage extends BasePage {
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly signInButton: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.locator('input#user_email');
        this.passwordInput = page.locator('input#user_password');
        this.signInButton = page.locator('input[name="commit"], input[type="submit"], button:has-text("Sign in")').first();
    }

    async navigateToLogin(url: string): Promise<void> {
        await this.page.goto(url);
        await this.page.waitForLoadState('networkidle');
    }

    async login(email: string, password: string): Promise<void> {
        await this.type(this.emailInput, email);
        await this.type(this.passwordInput, password);
        await this.click(this.signInButton);
        await this.page.waitForLoadState('networkidle');
    }
}
