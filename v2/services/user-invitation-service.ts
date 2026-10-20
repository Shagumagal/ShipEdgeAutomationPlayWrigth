import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import type { MailboxPort, MailMessage } from '../domain/mail/mailbox-port';
import { ROLE_LABELS, type InvitedUser, type XenvioUserRecord, type XenvioUserStatus } from '../domain/users/xenvio-user';
import type { XenvioApi } from '../infrastructure/xenvio-api';
import { INVITATION_SUBJECT, parseInvitationEmail, type InvitationLink } from '../parsers/invitation-email-parser';
import { KeycloakRegistrationPage } from '../page-objects/sso/keycloak-registration-page';
import { XenvioUsersPage } from '../page-objects/xenvio-users-page';

/** The reads the service needs from the backend (a fake in unit tests). */
export type XenvioUsersApi = Pick<XenvioApi, 'findXenvioUser'>;

export interface ReceivedInvitation {
    readonly message: MailMessage;
    readonly link: InvitationLink;
}

/**
 * Inviting a user and accepting the invitation, from both sides:
 *  - the admin, in the authenticated Shipper View (Users → Invite user)
 *  - the invitee, in a browser context with no Xenvio session (email → SSO sign-up → Xenvio)
 *
 * The email arrives through a MailboxPort, so the inbox provider can change without touching this
 * service. `api` must use the admin's session (context.request of the admin's browser context).
 */
export class UserInvitationService {
    constructor(
        private readonly api: XenvioUsersApi,
        private readonly mailbox: MailboxPort,
        private readonly emailTimeoutMs: number,
    ) {}

    /**
     * Invites `user` through the UI and returns the user the backend created. `onCreated` runs as
     * soon as its id is known, so the user is registered for cleanup even if a later step fails.
     */
    async invite(adminPage: Page, user: InvitedUser, onCreated?: (id: number) => void): Promise<XenvioUserRecord> {
        return allure.step(`Invite ${user.email} as ${ROLE_LABELS[user.role]}`, async () => {
            const usersPage = new XenvioUsersPage(adminPage);
            await usersPage.navigateToUsers();
            const dialog = await usersPage.openInviteDialog();
            await dialog.fill(user);
            await dialog.submitInvite();

            // POST /shipper/xenvio_users answers only {message}; the id comes from the list
            const created = await this.api.findXenvioUser(user.email);
            if (!created) {
                throw new Error(`Xenvio accepted the invitation of ${user.email} but does not list that user`);
            }
            onCreated?.(created.id);
            console.log(`✅ Invited ${user.email} (#${created.id})`);
            return created;
        });
    }

    /** Status the backend reports for `email`, or null when Xenvio has no such user. */
    async status(email: string): Promise<XenvioUserStatus | null> {
        return (await this.api.findXenvioUser(email))?.status ?? null;
    }

    /** Waits for the invitation email in the user's test inbox and reads its "Accept invitation" link. */
    async waitForInvitation(user: InvitedUser): Promise<ReceivedInvitation> {
        return allure.step(`Wait for the invitation email (${this.mailbox.name})`, async () => {
            const message = await this.mailbox.waitForMessage(user.email, {
                subject: INVITATION_SUBJECT,
                timeoutMs: this.emailTimeoutMs,
            });
            console.log(`📧 Invitation email received by ${user.email}`);
            return { message, link: parseInvitationEmail(message.html) };
        });
    }

    /**
     * Opens the "Accept invitation" link as the invitee and signs up in the SSO, which sends them
     * back to Xenvio. Returns the email the SSO pre-filled. `inviteePage` must not share the
     * admin's cookies.
     */
    async acceptInvitation(inviteePage: Page, link: InvitationLink, user: InvitedUser): Promise<{ prefilledEmail: string }> {
        return allure.step('Accept the invitation (SSO sign-up)', async () => {
            if (link.flow !== 'register') {
                throw new Error(`The invitation opens the SSO sign-in, not the sign-up: ${user.email} already has an SSO account`);
            }
            const registration = new KeycloakRegistrationPage(inviteePage);
            await registration.open(link.url);
            const prefilledEmail = await registration.prefilledEmail();
            await registration.register(user);
            console.log(`✅ ${user.email} signed up in the SSO and is back in Xenvio`);
            return { prefilledEmail };
        });
    }
}
