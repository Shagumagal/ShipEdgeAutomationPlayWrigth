import { test, expect } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../evidence/allure-helper';
import { mailboxProvider } from '../config/mailbox-config';
import { STATUS_LABELS } from '../domain/users/xenvio-user';
import { returnsToXenvio } from '../parsers/invitation-email-parser';
import { XenvioAccountOnHoldPage } from '../page-objects/xenvio-account-on-hold-page';
import { XenvioUsersPage } from '../page-objects/xenvio-users-page';
import { InvitedUserBuilder } from '../test-data';

/**
 * Xenvio User Invitation Test Suite (v2 — PrimeNG / Angular)
 *
 * An admin invites a new user; the invitation email reaches the user's inbox; the user accepts it
 * (SSO sign-up) and gets into Xenvio, where the account waits for an admin to activate it.
 *
 * Flow:
 *   1. Login as the admin → Shipper View → Configuration gear → Users → "Invite user"
 *   2. Email + role "User" + facility (WAREHOUSE_XENVIO) → Invite → the user is "Pending"
 *   3. The invitation email arrives in the test inbox (MAILBOX_PROVIDER)
 *   4. Its "Accept invitation" link opens the SSO sign-up for that email and returns to this Xenvio
 *   5. As the invitee (no admin cookies): sign up in the SSO → Xenvio shows "Account On Hold"
 *   6. The admin sees the user as "Inactive" (invitation accepted, not activated yet)
 *   7. The Xenvio user is deleted when the test ends (testData fixture)
 *
 * The SSO account the invitee creates is NOT deleted: the test has no admin access to the SSO.
 * Every run uses a new address, so leftover SSO accounts never collide (docs/19-user-invitation.md).
 *
 * Prerequisites (in .env):
 *   - XENVIO_URL, XENVIO_EMAIL, XENVIO_PASSWORD — XENVIO_EMAIL must be an admin (Users is admin only)
 *   - WAREHOUSE_XENVIO (facility given to the invited user)
 *   - MAILBOX_PROVIDER and that provider's settings; without it the test is skipped
 */
test.describe('Xenvio User Invitation (v2 PrimeNG)', { tag: ['@e2e', '@users'] }, () => {
    test.skip(!mailboxProvider(), 'No test inbox: set MAILBOX_PROVIDER in .env (docs/19-user-invitation.md)');

    test('TC-Xenvio-Users-001: Invite a user, receive the invitation email and accept it until Account On Hold', async ({
        xenvio,
        testData,
        mailbox,
        userInvitations,
        inviteePage,
    }) => {
        const config = xenvio.config;
        const user = InvitedUserBuilder.regularUser(config.warehouse).build(mailbox);

        // ─── Allure Metadata ─────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Invite user — ${user.email}`,
            owner: 'QA Automation Team',
            tags: ['xenvio', 'users', 'invitation', 'sso', 'e2e', 'v2', 'primeng'],
            severity: 'normal',
            epic: 'Xenvio',
            feature: 'User Management (v2 PrimeNG)',
            story: 'Invite a user and accept the invitation',
            parentSuite: 'Xenvio Configuration Suite',
            suite: 'User Management Tests',
            subSuite: 'User Invitation',
            url: config.url,
            environment: process.env.ENV_NAME || 'QA',
        });

        // Never the password: the report is shared
        await AllureHelper.addRunParameters({
            Email: user.email,
            Role: user.role,
            Facility: user.warehouse,
            Mailbox: mailbox.name,
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 1-2: Admin invites the user
        // ═══════════════════════════════════════════════════════════

        const session = await xenvio.openSession();
        const adminPage = session.page;
        const usersPage = new XenvioUsersPage(adminPage);

        const invited = await userInvitations.invite(adminPage, user, (id) => testData.track('xenvioUser', id, user.email));

        await allure.step('Verify the user is Pending', async () => {
            expect(invited.status, 'backend status right after the invitation').toBe('pending');
            expect(invited.role).toBe(user.role);
            expect(invited.warehouses.map(({ name }) => name)).toEqual([user.warehouse]);

            await usersPage.filterByEmail(user.email);
            await expect(usersPage.statusBadge(user.email)).toHaveText(STATUS_LABELS.pending);
            await AllureHelper.attachScreenShot(adminPage, 'User invited (Pending)');
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3-4: The invitation email arrives with the right link
        // ═══════════════════════════════════════════════════════════

        const { message, link } = await userInvitations.waitForInvitation(user);

        await allure.step('Verify the invitation link', async () => {
            await allure.attachment('Invitation email', message.html, 'text/html');

            expect(link.pathNormalized, `the SSO rejects a link with "//" in its path ("Request path not normalized"), so no invitee can accept it: ${link.url}`).toBe(true);
            expect(link.flow, 'a new address must get the SSO sign-up, not the sign-in').toBe('register');
            expect(link.loginHint.toLowerCase(), 'the SSO must pre-fill the invited email').toBe(user.email);
            expect(returnsToXenvio(link, config.url), `the SSO must send the invitee back to this Xenvio (redirect_uri: ${link.redirectUri})`).toBe(true);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: The invitee accepts → Account On Hold
        // ═══════════════════════════════════════════════════════════

        const { prefilledEmail } = await userInvitations.acceptInvitation(inviteePage, link, user);

        await allure.step('Verify the invitee sees Account On Hold', async () => {
            expect(prefilledEmail.toLowerCase(), 'email shown by the SSO sign-up').toBe(user.email);

            const onHoldPage = new XenvioAccountOnHoldPage(inviteePage);
            await expect(onHoldPage.heading).toBeVisible({ timeout: 60000 });
            await AllureHelper.attachScreenShot(inviteePage, 'Invitee — Account On Hold');
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: The admin sees the invitation accepted (Inactive)
        // ═══════════════════════════════════════════════════════════

        await allure.step('Verify the user is Inactive (accepted, not activated)', async () => {
            await expect.poll(() => userInvitations.status(user.email), {
                message: 'backend status after accepting the invitation',
                timeout: 30000,
            }).toBe('inactive');

            await usersPage.reload(user.email);
            await expect(usersPage.statusBadge(user.email)).toHaveText(STATUS_LABELS.inactive);
            await AllureHelper.attachScreenShot(adminPage, 'User accepted the invitation (Inactive)');
        });

        console.log(`\n🎉 User Invitation Test PASSED! User: ${user.email}`);
    });
});
