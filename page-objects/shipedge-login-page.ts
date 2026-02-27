import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Shipedge Login Page Object
 * 
 * Page Object for the Shipedge login page at /login.php
 * 
 * This page contains:
 * - Email/Username input field
 * - Password input field
 * - Login button
 * - "Forgot Password?" link
 * - "Register" link
 */
export class ShipedgeLoginPage extends BasePage {
    // ── Locators ──────────────────────────────────────────────
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;
    readonly forgotPasswordLink: Locator;
    readonly registerLink: Locator;
    readonly errorMessage: Locator;
    readonly pageTitle: Locator;

    constructor(page: Page) {
        super(page);

        // Input fields - adjusted for QA25 based on snapshot
        // Username field has placeholder "Enter your username"
        this.emailInput = page.getByRole('textbox', { name: /username|enter your username/i });

        // Password field has placeholder "Enter your password" 
        // Note: Password fields are sometimes not fully accessible by role 'textbox', so we fallback to placeholder if needed
        this.passwordInput = page.getByPlaceholder('Enter your password');

        // Buttons
        // The snapshot shows a button with text "LOGIN"
        this.loginButton = page.getByRole('button', { name: /login/i });

        // Links
        this.forgotPasswordLink = page.getByText(/forgot password/i).first();
        this.registerLink = page.getByText(/register/i).first();

        // Messages
        this.errorMessage = page.locator('.swal-modal, .swal-title, .alert-danger, .error-message');

        // Page title
        this.pageTitle = page.locator('title');
    }

    // ── Navigation ────────────────────────────────────────────

    /**
     * Navigate to the Shipedge login page
     */
    async navigateToLogin(): Promise<void> {
        await this.page.goto('/login.php');
        await this.page.waitForLoadState('networkidle');
    }

    // ── Actions ───────────────────────────────────────────────

    /**
     * Enter email/username in the email field
     */
    async enterEmail(email: string): Promise<void> {
        await this.type(this.emailInput, email);
    }

    /**
     * Enter password in the password field
     */
    async enterPassword(password: string): Promise<void> {
        await this.type(this.passwordInput, password);
    }

    /**
     * Click the Login button
     */
    async clickLogin(): Promise<void> {
        await this.click(this.loginButton);
    }

    /**
     * Perform complete login flow: enter email, password, and click login
     */
    async login(email: string, password: string): Promise<void> {
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.clickLogin();
    }

    /**
     * Click the "Forgot Password?" link
     */
    async clickForgotPassword(): Promise<void> {
        await this.click(this.forgotPasswordLink);
    }

    /**
     * Click the "Register" link
     */
    async clickRegister(): Promise<void> {
        await this.click(this.registerLink);
    }

    // ── Validations ───────────────────────────────────────────

    /**
     * Check if the login page has fully loaded by verifying
     * that the email and password inputs are visible
     */
    async waitForLoginPageLoad(): Promise<void> {
        await this.waitForElementToBeVisible(this.emailInput);
        await this.waitForElementToBeVisible(this.passwordInput);
    }

    /**
     * Check if the email input field is visible
     */
    async isEmailInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.emailInput);
    }

    /**
     * Check if the password input field is visible
     */
    async isPasswordInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.passwordInput);
    }

    /**
     * Check if the login button is visible
     */
    async isLoginButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.loginButton);
    }

    /**
     * Check if an error message is displayed after a failed login attempt
     */
    async isErrorMessageVisible(): Promise<boolean> {
        return await this.isElementVisible(this.errorMessage, 5000);
    }

    /**
     * Get the error message text after a failed login attempt
     */
    async getErrorMessage(): Promise<string> {
        return await this.getText(this.errorMessage);
    }

    /**
     * Check if the "Forgot Password?" link is visible
     */
    async isForgotPasswordLinkVisible(): Promise<boolean> {
        return await this.isElementVisible(this.forgotPasswordLink);
    }

    /**
     * Wait for successful login by checking URL changes away from login page
     */
    async waitForSuccessfulLogin(): Promise<void> {
        // After successful login, Shipedge typically redirects away from login page
        await this.page.waitForURL((url) => !url.toString().includes('/login.php'), {
            timeout: 30000,
        });
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Check if user is still on the login page (login failed)
     */
    async isStillOnLoginPage(): Promise<boolean> {
        const currentURL = this.page.url();
        return currentURL.includes('/login.php');
    }
}
