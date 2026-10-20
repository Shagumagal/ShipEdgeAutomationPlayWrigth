import { randomBytes } from 'node:crypto';
import type { MailboxPort } from '../domain/mail/mailbox-port';
import { automationStamp, INVITED_USER_TAG_PREFIX } from '../domain/test-data/automation-data';
import type { InvitedUser, XenvioUserRole } from '../domain/users/xenvio-user';

/**
 * Builds the user a test invites. The email comes from the test inbox (MailboxPort) and its tag is
 * unique per run ("qa-invite-20261019-072315-k3f9"), so parallel workers never invite the same
 * address and the purge recognizes the user (domain/test-data/automation-data.ts).
 */
export class InvitedUserBuilder {
    private constructor(
        private readonly role: XenvioUserRole,
        private readonly warehouse: string,
    ) {}

    /** Role "User" with access to one facility. */
    static regularUser(warehouse: string): InvitedUserBuilder {
        return new InvitedUserBuilder('regular_user', warehouse);
    }

    /** Role "Warehouse Manager" with access to one facility. */
    static warehouseManager(warehouse: string): InvitedUserBuilder {
        return new InvitedUserBuilder('warehouse_manager', warehouse);
    }

    /** @param stamp injectable so unit tests are deterministic. */
    build(mailbox: Pick<MailboxPort, 'addressFor'>, stamp: string = automationStamp()): InvitedUser {
        return Object.freeze({
            // Xenvio stores emails in lower case (User#normalize_email)
            email: mailbox.addressFor(`${INVITED_USER_TAG_PREFIX}${stamp}`).toLowerCase(),
            role: this.role,
            warehouse: this.warehouse,
            firstName: 'QA',
            lastName: `Invite ${stamp}`,
            password: generateSsoPassword(),
        });
    }
}

/**
 * A new random password per run for the invitee's SSO account: 20 characters with upper case, lower
 * case, digits and a symbol, so it passes the usual SSO password policies.
 */
export function generateSsoPassword(random: (size: number) => Buffer = randomBytes): string {
    return `Qa${random(12).toString('base64url')}7!`;
}
