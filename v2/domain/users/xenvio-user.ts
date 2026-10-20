/**
 * Xenvio users and invitations. Pure module — no Playwright.
 *
 * Backend: x5.xenvio app/services/shipper/xenvio_users/ (Creator, Fetcher, Destroyer).
 * Front-end: x5.angular src/app/users/ (users-list, user-form-dialog).
 */

/** Role values the backend accepts (Fetcher::ALLOWED_ROLES). */
export type XenvioUserRole = 'admin' | 'warehouse_manager' | 'regular_user';

/**
 * Status the users list reports (Fetcher#get_status):
 *  - pending:  invited, invitation not accepted yet
 *  - inactive: invitation accepted, waiting for an admin to activate the account ("Account On Hold")
 *  - active:   can use Xenvio
 */
export type XenvioUserStatus = 'active' | 'pending' | 'inactive';

/** Label of each role in the "Role" p-select of the invite dialog (user-form-dialog rolesSignal). */
export const ROLE_LABELS: Readonly<Record<XenvioUserRole, string>> = Object.freeze({
    admin: 'Admin',
    warehouse_manager: 'Warehouse Manager',
    regular_user: 'User',
});

/** Label of each status in the users table (users-list.component.html). */
export const STATUS_LABELS: Readonly<Record<XenvioUserStatus, string>> = Object.freeze({
    active: 'Active',
    pending: 'Pending',
    inactive: 'Inactive',
});

/** A user the test invites, with what the invitee types when accepting the invitation. */
export interface InvitedUser {
    readonly email: string;
    readonly role: XenvioUserRole;
    /** Facility (warehouse) name; ignored for admins, who see every warehouse. */
    readonly warehouse: string;
    readonly firstName: string;
    readonly lastName: string;
    /** Password the invitee sets in the SSO. Never log it or attach it to the report. */
    readonly password: string;
}

/** A row of GET /shipper/xenvio_users (Fetcher#format_data). */
export interface XenvioUserRecord {
    readonly id: number;
    readonly email: string;
    readonly role: string;
    readonly status: XenvioUserStatus;
    readonly warehouses: ReadonlyArray<{ id: number; name: string }>;
}
