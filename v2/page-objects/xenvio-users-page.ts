import { Locator, Page } from '@playwright/test';
import BasePage from './base-page';
import { XenvioConfigMenu } from './components/xenvio-config-menu';
import { XenvioUserFormDialog } from './components/xenvio-user-form-dialog';

/**
 * Page Object: XenvioUsersPage (v2 — Angular + PrimeNG)
 *
 * Shipper View → Configuration gear → "Users" (/users, admins only).
 * Source: x5.angular src/app/users/users-list/ → p-table of the account's users (the logged-in
 * admin is never listed), "Invite user" button and one filter per column.
 *
 * Delegates to:
 *   - this.menu → XenvioConfigMenu (header gear menu)
 *   - this.inviteDialog → XenvioUserFormDialog ("Invite new user")
 */
export class XenvioUsersPage extends BasePage {

    readonly menu: XenvioConfigMenu;
    readonly inviteDialog: XenvioUserFormDialog;

    readonly heading: Locator;
    readonly inviteUserButton: Locator;
    readonly emailFilterInput: Locator;
    readonly rows: Locator;

    constructor(page: Page) {
        super(page);
        this.menu = new XenvioConfigMenu(page);
        this.inviteDialog = new XenvioUserFormDialog(page);

        this.heading = page.locator('h1').filter({ hasText: /^\s*Users\s*$/ });
        this.inviteUserButton = page.getByRole('button', { name: 'Invite user' });
        this.emailFilterInput = page.locator('input[placeholder="Filter by email"]');
        this.rows = page.locator('p-table tbody tr');
    }

    async navigateToUsers(): Promise<void> {
        console.log('Navigating to Users...');
        await this.menu.open('users');
        await this.waitForElementToBeVisible(this.heading, 30000);
        await this.waitForXenvioLoading(15000);
        console.log('✅ Users screen opened');
    }

    async openInviteDialog(): Promise<XenvioUserFormDialog> {
        await this.click(this.inviteUserButton);
        await this.inviteDialog.waitForOpen();
        return this.inviteDialog;
    }

    /** Filters the table by email and waits for the backend to answer the filtered list. */
    async filterByEmail(email: string): Promise<void> {
        const filtered = this.page.waitForResponse((response) => response.request().method() === 'GET'
            && new URL(response.url()).pathname === '/shipper/xenvio_users'
            && new URL(response.url()).searchParams.has('filters'));
        await this.type(this.emailFilterInput, email);
        await filtered;
    }

    /** Re-reads the list from the backend (the table does not refresh by itself). */
    async reload(email: string): Promise<void> {
        await this.page.reload();
        await this.waitForElementToBeVisible(this.heading, 30000);
        await this.filterByEmail(email);
    }

    rowFor(email: string): Locator {
        return this.rows.filter({ has: this.page.locator('td').getByText(email, { exact: true }) });
    }

    /** Status badge of the row: "Active", "Pending" or "Inactive". */
    statusBadge(email: string): Locator {
        return this.rowFor(email).locator('span.rounded-lg');
    }
}
