import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";
import logger from "../lib/logger";

// Initialize logger for this module
const log = logger({ filename: __filename });

/**
 * Xenvio Invite User Page Object
 *
 * Handles the "Users" section inside the Xenvio Shipper View popup:
 *   - Open the user menu (kebab/avatar button in the top nav)
 *   - Navigate to the "Users" menu item
 *   - Open the "Invite user" modal
 *   - Fill in email, role, and facility
 *   - Submit the invitation
 *
 * This Page Object operates on the popup Page returned by
 * XenvioDashboardPage.openShipperView().
 */
export class XenvioInviteUserPage extends BasePage {

    // ─── Top Navigation ────────────────────────────────────────
    /** The second button in the top nav (avatar / user menu) */
    readonly userMenuButton: Locator;

    // ─── User Menu Dropdown ────────────────────────────────────
    /** The "Users" item inside the user dropdown menu */
    readonly usersMenuItem: Locator;

    // ─── Invite User Button ────────────────────────────────────
    /** The primary "Invite user" button on the Users list page */
    readonly inviteUserButton: Locator;

    // ─── Invite User Modal Fields ──────────────────────────────
    /** Email input inside the invite modal */
    readonly emailInput: Locator;

    /** Role combobox (Select an Option) */
    readonly roleDropdown: Locator;

    /** Facility/Warehouse selector button */
    readonly facilityButton: Locator;

    /** "Save" button to submit the invitation */
    readonly saveButton: Locator;

    /** Success toast or message */
    readonly successMessage: Locator;

    constructor(page: Page) {
        super(page);

        // ─── Top Navigation ──────────────────────────────────────
        // Second button in the top nav bar (avatar / user icon)
        this.userMenuButton = page.getByRole('button').nth(1);

        // ─── User Menu Items ─────────────────────────────────────
        this.usersMenuItem = page.getByRole('menuitem', { name: ' Users' });

        // ─── Users Page ──────────────────────────────────────────
        this.inviteUserButton = page.getByRole('button', { name: ' Invite user' });

        // ─── Invite Modal ─────────────────────────────────────────
        this.emailInput    = page.getByRole('textbox', { name: 'Email *' });
        this.roleDropdown  = page.getByRole('combobox', { name: 'Select an Option' });
        this.facilityButton = page.getByRole('button', { name: 'Facility (Warehouse) *' });
        this.saveButton    = page.getByRole('button', { name: 'Save' });
        this.successMessage = page.locator('div[role="status"], .mat-snack-bar-container, text=/invitation sent/i');
    }

    // ─── Assertions / State Checks ──────────────────────────────

    /**
     * Check if the success message or toast is visible.
     */
    async isSuccessVisible(): Promise<boolean> {
        return await this.isElementVisible(this.successMessage, 10000);
    }

    // ══════════════════════════════════════════════════════════════
    // Navigation Methods
    // ══════════════════════════════════════════════════════════════

    /**
     * Open the user dropdown menu (avatar button in top nav).
     */
    async openUserMenu(): Promise<void> {
        log.info('Opening user menu in Shipper View top nav');
        await this.waitForElementToBeVisible(this.userMenuButton);
        await this.click(this.userMenuButton);
        log.debug('User menu opened');
    }

    /**
     * Click the "Users" menu item inside the dropdown.
     */
    async clickUsersMenuItem(): Promise<void> {
        log.info('Clicking "Users" menu item');
        await this.waitForElementToBeVisible(this.usersMenuItem);
        await this.click(this.usersMenuItem);
        await this.page.waitForLoadState('networkidle');
        log.info('Navigated to Users page');
    }

    // ══════════════════════════════════════════════════════════════
    // Invite User Modal Methods
    // ══════════════════════════════════════════════════════════════

    /**
     * Click the "Invite user" button to open the invitation modal.
     */
    async clickInviteUser(): Promise<void> {
        log.info('Opening Invite User modal');
        await this.waitForElementToBeVisible(this.inviteUserButton);
        await this.click(this.inviteUserButton);
        await this.waitForElementToBeVisible(this.emailInput);
        log.debug('Invite User modal is visible');
    }

    /**
     * Fill the email field in the Invite User modal.
     * @param email The email address to invite
     */
    async fillEmail(email: string): Promise<void> {
        log.info('Filling invite email', { email });
        await this.waitForElementToBeVisible(this.emailInput);
        await this.click(this.emailInput);
        await this.type(this.emailInput, email);
    }

    /**
     * Select a role from the role dropdown.
     * @param role The visible option text, e.g. 'User' or 'Admin'
     */
    async selectRole(role: string): Promise<void> {
        log.info('Selecting role', { role });
        await this.waitForElementToBeVisible(this.roleDropdown);
        await this.click(this.roleDropdown);
        const option = this.page.getByRole('option', { name: role });
        await this.waitForElementToBeVisible(option);
        await this.click(option);
        log.debug(`Role "${role}" selected`);
    }

    /**
     * Open the Facility dropdown and select a facility by exact label.
     * @param facilityName Exact facility/warehouse label (e.g. 'qa20')
     */
    async selectFacility(facilityName: string): Promise<void> {
        log.info('Selecting facility', { facility: facilityName });
        await this.waitForElementToBeVisible(this.facilityButton);
        await this.click(this.facilityButton);

        // Matches the label with exact text (handles leading/trailing whitespace)
        const facilityLabel = this.page
            .locator('label')
            .filter({ hasText: new RegExp(`^${facilityName}$`) });

        await this.waitForElementToBeVisible(facilityLabel);
        await this.click(facilityLabel);
        log.debug(`Facility "${facilityName}" selected`);
    }

    /**
     * Click the "Save" button to submit the invitation.
     */
    async clickSave(): Promise<void> {
        log.info('Submitting invite user form');
        await this.waitForElementToBeVisible(this.saveButton);
        await this.click(this.saveButton);
        await this.page.waitForLoadState('networkidle');
        log.info('Invite user form submitted');
    }

    // ══════════════════════════════════════════════════════════════
    // Visibility Check Methods
    // ══════════════════════════════════════════════════════════════

    async isInviteUserButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.inviteUserButton);
    }

    async isEmailInputVisible(): Promise<boolean> {
        return await this.isElementVisible(this.emailInput);
    }

    async isSaveButtonVisible(): Promise<boolean> {
        return await this.isElementVisible(this.saveButton);
    }
}
