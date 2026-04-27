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
    userMenuButton!: Locator;

    // ─── User Menu Dropdown ────────────────────────────────────
    /** The "Users" item inside the user dropdown menu */
    usersMenuItem!: Locator;

    // ─── Invite User Button ────────────────────────────────────
    /** The primary "Invite user" button on the Users list page */
    inviteUserButton!: Locator;

    // ─── Invite User Modal Fields ──────────────────────────────
    /** Email input inside the invite modal */
    emailInput!: Locator;

    /** Role combobox (Select an Option) */
    roleDropdown!: Locator;

    /** Facility/Warehouse selector button */
    facilityButton!: Locator;

    /** "Save" button to submit the invitation */
    saveButton!: Locator;

    /** Success toast or message */
    successMessage!: Locator;

    // ─── Users List Actions ─────────────────────────────────────
    /** Filter input to search by email in the users list */
    filterByEmailInput!: Locator;

    /** Row-level kebab menu trigger (three dots) */
    rowActionsMenu!: Locator;

    /** "Activate" option inside the row actions menu */
    activateMenuItem!: Locator;

    // ─── New User Modal Search ─────────────────────────────────
    /** Search input inside the Facility selection dropdown */
    facilitySearchInput!: Locator;

    // ─── Logout ────────────────────────────────────────────────
    /** "Log Out" menuitem inside the user dropdown */
    logoutMenuItem!: Locator;

    constructor(page: Page) {
        super(page);
        this.initLocators();
    }

    /**
     * Updates the page context (e.g. when switching to a popup) and re-initializes all locators.
     */
    setPage(newPage: Page) {
        this.page = newPage;
        this.initLocators();
    }

    private initLocators() {
        // ─── Top Navigation ──────────────────────────────────────
        // Second button in the top nav bar (avatar / user icon)
        this.userMenuButton = this.page.getByRole('button').nth(1);

        // ─── User Menu Items ─────────────────────────────────────
        this.usersMenuItem  = this.page.getByRole('menuitem', { name: ' Users' });
        this.logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log Out' });

        // ─── Users Page ──────────────────────────────────────────
        this.inviteUserButton   = this.page.getByRole('button', { name: ' Invite user' });
        this.filterByEmailInput = this.page.getByRole('textbox', { name: 'Filter by email' });
        this.rowActionsMenu     = this.page.locator('.mat-mdc-menu-trigger.p-1.hover\\:bg-gray-100');
        this.activateMenuItem   = this.page.getByRole('menuitem', { name: 'Activate' });

        // ─── Invite Modal ─────────────────────────────────────────
        this.emailInput     = this.page.getByRole('textbox', { name: 'Email *' });
        this.roleDropdown   = this.page.getByRole('combobox', { name: 'Select an Option' });
        this.facilityButton = this.page.getByRole('button', { name: 'Facility (Warehouse) *' });
        this.facilitySearchInput = this.page.getByPlaceholder('Search...');
        this.saveButton     = this.page.getByRole('button', { name: 'Save' });
        this.successMessage = this.page.locator('div[role="status"], .mat-snack-bar-container, text=/invitation sent/i');
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
     * Log out from the Shipper View.
     * Opens the user menu and clicks "Log Out".
     */
    async logout(): Promise<void> {
        log.info('Logging out from Shipper View');
        await this.openUserMenu();
        await this.waitForElementToBeVisible(this.logoutMenuItem);
        await this.click(this.logoutMenuItem);
        await this.page.waitForLoadState('networkidle');
        log.info('Logged out successfully');
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
     * Open the Facility dropdown, search for a facility, and select it.
     * @param facilityName Exact or partial facility/warehouse label (e.g. 'qa20')
     */
    async selectFacility(facilityName: string): Promise<void> {
        log.info('Selecting facility via search (slow mode)', { facility: facilityName });
        
        await this.waitForElementToBeVisible(this.facilityButton);
        await this.click(this.facilityButton);
        
        // Wait for the search input to be interactable
        await this.waitForElementToBeVisible(this.facilitySearchInput);
        await this.page.waitForTimeout(500); // Small pause for the dropdown animation
        
        // We use pressSequentially with a delay to simulate human typing
        // and trigger the search-as-you-type logic correctly.
        await this.facilitySearchInput.click();
        await this.facilitySearchInput.fill(''); // Clear first
        await this.facilitySearchInput.pressSequentially(facilityName, { delay: 200 });
        
        log.debug('Waiting for list to filter...');
        await this.page.waitForTimeout(1000); // Give it time to filter the results

        // To ensure we click the exact choice and not an unrelated element,
        // we find the exact text node within the modal/dropdown.
        const facilityLabel = this.page.getByText(facilityName, { exact: true }).first();

        await facilityLabel.waitFor({ state: 'visible', timeout: 10000 });
        await this.click(facilityLabel);
        
        log.info(`Facility "${facilityName}" selected successfully`);
        await this.page.waitForTimeout(500); // Safety pause
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
    // Users List Methods
    // ══════════════════════════════════════════════════════════════

    /**
     * Filter/search users by email in the users list.
     * @param email The email to search for
     */
    async filterByEmail(email: string): Promise<void> {
        log.info('Filtering users by email', { email });
        await this.waitForElementToBeVisible(this.filterByEmailInput);
        await this.click(this.filterByEmailInput);
        await this.type(this.filterByEmailInput, email);
        await this.page.waitForLoadState('networkidle');
        log.debug(`Filtered by email: ${email}`);
    }

    /**
     * Click the row kebab menu and select "Activate" for a user.
     */
    async clickActivateUser(): Promise<void> {
        log.info('Activating invited user');
        await this.waitForElementToBeVisible(this.rowActionsMenu);
        await this.click(this.rowActionsMenu);
        await this.waitForElementToBeVisible(this.activateMenuItem);
        await this.click(this.activateMenuItem);
        await this.page.waitForLoadState('networkidle');
        log.info('User activated successfully');
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
