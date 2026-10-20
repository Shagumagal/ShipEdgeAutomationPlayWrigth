import { Locator, Page } from '@playwright/test';
import BasePage from '../base-page';
import { findFacilityCardIndex } from '../../domain/facilities/facility-match';
import { ROLE_LABELS, type InvitedUser, type XenvioUserRole } from '../../domain/users/xenvio-user';

/** Endpoint the dialog's "Invite" button ends up calling (core/services/users.service.ts → inviteUser). */
export const INVITE_USER_PATH = '/shipper/xenvio_users';

/**
 * Component: "Invite new user" dialog of the Users screen (v2).
 * Source: x5.angular src/app/users/user-form-dialog/ (MatDialog with PrimeNG controls)
 *
 *   - Email   → input#email
 *   - Role    → p-select formControlName="role" (Admin | Warehouse Manager | User)
 *   - Facility→ custom dropdown (button aria-labelledby="facilityLabel") with a search box and one
 *               checkbox per warehouse; hidden for admins, required for the other roles
 *   - Invite  → closes the dialog; the users list then POSTs /shipper/xenvio_users
 */
export class XenvioUserFormDialog extends BasePage {

    readonly root: Locator;
    readonly emailInput: Locator;
    readonly roleSelect: Locator;
    readonly facilityButton: Locator;
    readonly facilitySearchInput: Locator;
    readonly facilityOptions: Locator;
    readonly inviteButton: Locator;

    constructor(page: Page) {
        super(page);
        this.root = page.locator('app-user-form-dialog');
        this.emailInput = this.root.locator('input#email');
        this.roleSelect = this.root.locator('p-select[formcontrolname="role"]');
        this.facilityButton = this.root.locator('button[aria-labelledby="facilityLabel"]');
        this.facilitySearchInput = this.root.locator('input[aria-label="Search facilities"]');
        this.facilityOptions = this.root.locator('label[for^="warehouse-"]');
        this.inviteButton = this.root.getByRole('button', { name: 'Invite', exact: true });
    }

    async waitForOpen(): Promise<void> {
        await this.waitForElementToBeVisible(this.emailInput, 10000);
    }

    async fill(user: Pick<InvitedUser, 'email' | 'role' | 'warehouse'>): Promise<void> {
        await this.type(this.emailInput, user.email);
        await this.selectRole(user.role);
        if (user.role !== 'admin') {
            await this.selectFacility(user.warehouse);
        }
    }

    async selectRole(role: XenvioUserRole): Promise<void> {
        await this.selectPrimeNGDropdown(this.roleSelect, ROLE_LABELS[role], 5000, true);
    }

    /**
     * Checks exactly the facility named `warehouseName` (a substring match would also pick
     * "clon de qa22" for "qa22"; see domain/facilities/facility-match.ts).
     */
    async selectFacility(warehouseName: string): Promise<void> {
        // Disabled until a role is chosen and GET /warehouses answered; click() waits for it
        await this.facilityButton.click({ timeout: 30000 });
        await this.type(this.facilitySearchInput, warehouseName);
        await this.waitForElementToBeVisible(this.facilityOptions.first(), 10000);

        const option = this.facilityOptions.nth(findFacilityCardIndex(await this.facilityOptions.allInnerTexts(), warehouseName));
        await option.click();
        // The option turns blue once the warehouse is in the form value (isWarehouseSelected)
        await option.and(this.root.locator('label.bg-blue-50')).waitFor({ state: 'visible', timeout: 5000 });

        // Close the dropdown: it closes on any click outside it
        await this.root.locator('h2').first().click();
    }

    /**
     * Sends the invitation and returns the backend's answer. A rejected invitation (e.g. "Email
     * already exists") throws with the server message right away.
     */
    async submitInvite(): Promise<{ message: string }> {
        return this.clickAndCaptureCreation<{ message: string }>(this.inviteButton, INVITE_USER_PATH);
    }
}
