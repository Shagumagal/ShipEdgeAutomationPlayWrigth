import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Example Login Page Object
 * 
 * This demonstrates the Page Object Model pattern:
 * - Extends BasePage for common functionality
 * - Defines locators as readonly properties
 * - Provides methods for page interactions
 * - Uses Playwright's recommended locator strategies (getByRole, getByText, etc.)
 */
export class ExampleLoginPage extends BasePage {
    // Locator definitions - using Playwright's recommended locator strategies
    readonly loginButton: Locator;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly forgotPasswordLink: Locator;
    readonly errorMessage: Locator;
    readonly successMessage: Locator;
    readonly rememberMeCheckbox: Locator;
    readonly signUpLink: Locator;

    constructor(page: Page) {
        super(page);
        
        // Initialize locators using Playwright's recommended methods
        // Priority order: getByRole > getByText > getByLabel > getByPlaceholder > getByTestId
        this.loginButton = page.getByRole('button', { name: 'Log In' });
        this.emailInput = page.getByRole('textbox', { name: /email/i });
        this.passwordInput = page.getByRole('textbox', { name: /password/i });
        this.submitButton = page.getByRole('button', { name: /submit|sign in|log in/i });
        this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
        this.errorMessage = page.getByText(/invalid|error|incorrect/i);
        this.successMessage = page.getByText(/success|welcome|logged in/i);
        this.rememberMeCheckbox = page.getByRole('checkbox', { name: /remember me/i });
        this.signUpLink = page.getByRole('link', { name: /sign up|register/i });
    }

    /**
     * Navigate to login page
     */
    async navigateToLogin() {
        await this.page.goto('/login');
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Fill email input field
     */
    async enterEmail(email: string) {
        await this.type(this.emailInput, email);
    }

    /**
     * Fill password input field
     */
    async enterPassword(password: string) {
        await this.type(this.passwordInput, password);
    }

    /**
     * Click submit/login button
     */
    async clickSubmit() {
        await this.click(this.submitButton);
    }

    /**
     * Perform complete login flow
     */
    async login(email: string, password: string) {
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.clickSubmit();
    }

    /**
     * Click forgot password link
     */
    async clickForgotPassword() {
        await this.click(this.forgotPasswordLink);
    }

    /**
     * Check if error message is visible
     */
    async isErrorMessageVisible(): Promise<boolean> {
        return await this.isElementVisible(this.errorMessage);
    }

    /**
     * Check if success message is visible
     */
    async isSuccessMessageVisible(): Promise<boolean> {
        return await this.isElementVisible(this.successMessage);
    }

    /**
     * Get error message text
     */
    async getErrorMessage(): Promise<string> {
        return await this.getText(this.errorMessage);
    }

    /**
     * Check if email input is visible
     */
    async isEmailInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.emailInput);
    }

    /**
     * Check if password input is visible
     */
    async isPasswordInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.passwordInput);
    }

    /**
     * Wait for login page to load
     */
    async waitForLoginPage() {
        await this.waitForElementToBeVisible(this.emailInput);
        await this.waitForElementToBeVisible(this.passwordInput);
    }

    /**
     * Wait for URL to contain specific path after login
     */
    async waitForSuccessfulLogin(expectedPath: string = '/dashboard') {
        await this.waitForURLContains(expectedPath);
    }
}
