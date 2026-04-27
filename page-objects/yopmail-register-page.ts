import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";
import logger from "../lib/logger";

// Initialize logger for this module
const log = logger({ filename: __filename });

/**
 * YopMail & Keycloak Registration Page Object
 *
 * Handles the external invitation acceptance flow:
 *   1. Open YopMail inbox for the invited email
 *   2. Open the "Accept invitation" link from the email (popup)
 *   3. Fill in password, confirm password, first name, last name
 *   4. Submit the registration form
 *
 * YopMail is a disposable email service used in QA environments.
 * The Page Object operates on the page returned after navigating to yopmail.com.
 */
export class YopmailRegisterPage extends BasePage {

    // ─── YopMail Inbox ─────────────────────────────────────────
    /** The "Check inbox" button / email input area on yopmail.com */
    inboxCheckButton!: Locator;

    /** The iframe containing the received email body */
    emailIframe!: Locator;

    /** "Accept invitation" link inside the email body iframe */
    acceptInvitationLink!: Locator;

    // ─── Keycloak Registration Form ────────────────────────────
    /** Password field */
    passwordInput!: Locator;

    /** Confirm password field */
    confirmPasswordInput!: Locator;

    /** First name field */
    firstNameInput!: Locator;

    /** Last name field */
    lastNameInput!: Locator;

    /** Register / Submit button */
    registerButton!: Locator;

    constructor(page: Page) {
        super(page);
        this.initLocators();
    }

    /**
     * Updates the page context (e.g. when switching to the registration popup)
     * and re-initializes all locators.
     */
    setPage(newPage: Page) {
        this.page = newPage;
        this.initLocators();
    }

    private initLocators() {
        // ─── YopMail Inbox ──────────────────────────────────────
        // Button/link to check the inbox for a given yopmail address
        this.inboxCheckButton = this.page.getByTitle('Revisa el correo @yopmail.com');

        // iframe[name="ifmail"] holds the email body
        this.emailIframe = this.page.locator('iframe[name="ifmail"]');

        // The "Accept invitation" link is inside the iframe
        this.acceptInvitationLink = this.page
            .frameLocator('iframe[name="ifmail"]')
            .getByRole('link', { name: 'Accept invitation' });

        // ─── Keycloak Registration Form ─────────────────────────
        this.passwordInput        = this.page.getByRole('textbox', { name: 'Password', exact: true });
        this.confirmPasswordInput = this.page.getByRole('textbox', { name: 'Confirm password' });
        this.firstNameInput       = this.page.getByRole('textbox', { name: 'First name' });
        this.lastNameInput        = this.page.getByRole('textbox', { name: 'Last name' });
        this.registerButton       = this.page.getByRole('button', { name: 'Register' });
    }

    // ══════════════════════════════════════════════════════════════
    // YopMail Methods
    // ══════════════════════════════════════════════════════════════

    /**
     * Navigate to the YopMail website.
     */
    async navigateToYopmail(): Promise<void> {
        log.info('Navigating to YopMail');
        await this.page.goto('https://yopmail.com/es/');
        await this.page.waitForLoadState('networkidle');
        log.debug('YopMail loaded');
    }

    /**
     * Click the inbox check button to load the inbox for the pre-set email.
     */
    async openInbox(): Promise<void> {
        log.info('Opening YopMail inbox');
        await this.waitForElementToBeVisible(this.inboxCheckButton);
        await this.click(this.inboxCheckButton);
        await this.page.waitForLoadState('networkidle');
        log.debug('YopMail inbox opened');
    }

    /**
     * Click the "Accept invitation" link inside the YopMail email body.
     * Returns the popup Page that opens for the Keycloak registration form.
     */
    async clickAcceptInvitation(): Promise<Page> {
        log.info('Clicking "Accept invitation" link in YopMail email');

        // Wait for the iframe to load
        await this.emailIframe.waitFor({ state: 'visible', timeout: 30000 });

        // Set up popup listener before clicking
        const popupPromise = this.page.waitForEvent('popup');
        await this.acceptInvitationLink.click();
        const registrationPage = await popupPromise;

        await registrationPage.waitForLoadState('networkidle');
        log.info('Registration popup opened via YopMail link');
        return registrationPage;
    }

    // ══════════════════════════════════════════════════════════════
    // Keycloak Registration Form Methods
    // ══════════════════════════════════════════════════════════════

    /**
     * Fill the password field in the Keycloak registration form.
     * @param password The password to set for the new account
     */
    async fillPassword(password: string): Promise<void> {
        log.info('Filling password in registration form');
        await this.waitForElementToBeVisible(this.passwordInput);
        await this.click(this.passwordInput);
        await this.type(this.passwordInput, password);
    }

    /**
     * Fill the confirm password field.
     * @param password Must match the value used in fillPassword()
     */
    async fillConfirmPassword(password: string): Promise<void> {
        log.info('Filling confirm password in registration form');
        await this.waitForElementToBeVisible(this.confirmPasswordInput);
        await this.click(this.confirmPasswordInput);
        await this.type(this.confirmPasswordInput, password);
    }

    /**
     * Fill the first name field.
     * @param firstName The first name for the new user
     */
    async fillFirstName(firstName: string): Promise<void> {
        log.info('Filling first name in registration form');
        await this.waitForElementToBeVisible(this.firstNameInput);
        await this.click(this.firstNameInput);
        await this.type(this.firstNameInput, firstName);
        await this.firstNameInput.press('Tab');
    }

    /**
     * Fill the last name field.
     * @param lastName The last name for the new user
     */
    async fillLastName(lastName: string): Promise<void> {
        log.info('Filling last name in registration form');
        await this.waitForElementToBeVisible(this.lastNameInput);
        await this.type(this.lastNameInput, lastName);
    }

    /**
     * Submit the registration form.
     * Waits for the page to reach a stable state after submission.
     */
    async clickRegister(): Promise<void> {
        log.info('Submitting registration form');
        await this.waitForElementToBeVisible(this.registerButton);
        await this.click(this.registerButton);
        await this.page.waitForLoadState('networkidle');
        log.info('Registration form submitted');
    }

    /**
     * Complete end-to-end registration form: password, confirm, first name, last name, and submit.
     * All fields delegate to their individual fill methods for consistent logging.
     */
    async completeRegistration(data: {
        password: string;
        firstName: string;
        lastName: string;
    }): Promise<void> {
        log.info('Completing full registration form', { firstName: data.firstName, lastName: data.lastName });
        await this.fillPassword(data.password);
        await this.fillConfirmPassword(data.password);
        await this.fillFirstName(data.firstName);
        await this.fillLastName(data.lastName);
        await this.clickRegister();
        log.info('Registration completed');
    }

    // ══════════════════════════════════════════════════════════════
    // Visibility Check Methods
    // ══════════════════════════════════════════════════════════════

    async isRegisterButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.registerButton);
    }

    async isPasswordInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.passwordInput);
    }
}
