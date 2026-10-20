import { test, expect } from '@playwright/test';
import { parseInvitationEmail, returnsToXenvio } from '../parsers/invitation-email-parser';
import { InvitedUserBuilder, generateSsoPassword } from '../test-data/invited-user-builder';
import { subjectMatches } from '../domain/mail/mailbox-port';

const EMAIL = 'qa-invite-20261019-072315-k3f9@inbox.example.test';

/** Same markup as x5.xenvio app/views/devise/mailer/invitation_instructions.html.erb renders. */
function invitationHtml(href: string): string {
    return `
        <p>Hello ${EMAIL}</p>
        <p>Someone has invited you to <a href="https://x52.shipedge.com/">https://x52.shipedge.com/</a>, you can accept it through the link below.</p>
        <p>
        <a href="${href}">Accept invitation</a>
        </p>
        <p>If you don't want to accept the invitation, please ignore this email.</p>`;
}

// keycloak_site ends with "/" in the altacrest environments, so the real link has "//realms"
const REGISTER_LINK = 'https://sso.omniorders.com//realms/altacrest/protocol/openid-connect/registrations'
    + '?client_id=xenvio&amp;redirect_uri=https://x52.shipedge.com/users/auth/keycloakopenid/callback'
    + `&amp;response_type=code&amp;kc_locale=EN&amp;scope=openid&amp;login_hint=${EMAIL}`;

test.describe('Invitation email', { tag: ['@unit', '@users'] }, () => {

    test('reads the "Accept invitation" link of a new user (SSO sign-up)', () => {
        const link = parseInvitationEmail(invitationHtml(REGISTER_LINK));

        expect(link.flow).toBe('register');
        expect(link.loginHint).toBe(EMAIL);
        expect(link.ssoOrigin).toBe('https://sso.omniorders.com');
        expect(link.redirectUri).toBe('https://x52.shipedge.com/users/auth/keycloakopenid/callback');
        expect(link.url).not.toContain('&amp;'); // ready to open
    });

    test('flags a link whose path the SSO rejects as not normalized ("//realms")', () => {
        expect(parseInvitationEmail(invitationHtml(REGISTER_LINK)).pathNormalized).toBe(false);
        expect(parseInvitationEmail(invitationHtml(REGISTER_LINK.replace('.com//realms', '.com/realms'))).pathNormalized).toBe(true);
    });

    test('an email that already has an SSO account gets the sign-in link', () => {
        const href = 'https://sso.omniorders.com/realms/altacrest/protocol/openid-connect/auth?client_id=xenvio'
            + '&amp;redirect_uri=https://x52.shipedge.com/users/auth/keycloakopenid/callback&amp;response_type=code'
            + `&amp;scope=openid+profile+email&amp;login_hint=${EMAIL}`;

        expect(parseInvitationEmail(invitationHtml(href)).flow).toBe('login');
    });

    test('ignores the other links and the markup around the button text', () => {
        const html = invitationHtml(REGISTER_LINK)
            .replace('>Accept invitation<', '><span style="color:#fff"> Accept&nbsp;invitation </span><');

        expect(parseInvitationEmail(html).flow).toBe('register');
    });

    test('fails clearly without the button or when it does not open the SSO', () => {
        expect(() => parseInvitationEmail('<p>Hello</p><a href="https://x52.shipedge.com/">Xenvio</a>'))
            .toThrow('The invitation email has no "Accept invitation" link');
        expect(() => parseInvitationEmail(invitationHtml('https://x52.shipedge.com/users/invitation/accept?invitation_token=abc')))
            .toThrow(/does not open the SSO sign-up or sign-in/);
    });

    test('the SSO must send the invitee back to the Xenvio environment that invited them', () => {
        const link = parseInvitationEmail(invitationHtml(REGISTER_LINK));

        expect(returnsToXenvio(link, 'https://x52.shipedge.com/users/sign_in')).toBe(true);
        expect(returnsToXenvio(link, 'https://x5demo1.shipedge.com/users/sign_in')).toBe(false);

        const localhost = parseInvitationEmail(invitationHtml(REGISTER_LINK.replace('https://x52.shipedge.com', 'http://localhost:3000')));
        expect(returnsToXenvio(localhost, 'https://x52.shipedge.com/users/sign_in')).toBe(false);
    });

    test('subjects match exactly, ignoring case, or by pattern', () => {
        expect(subjectMatches('Invitation instructions', 'invitation instructions')).toBe(true);
        expect(subjectMatches('Fwd: Invitation instructions', 'Invitation instructions')).toBe(false);
        expect(subjectMatches('Fwd: Invitation instructions', /invitation/i)).toBe(true);
    });
});

test.describe('Invited user', { tag: ['@unit', '@users'] }, () => {
    const mailbox = { addressFor: (tag: string) => `Team.${tag}@Inbox.Example.Test` };

    test('takes its address from the test inbox, with a tag unique to the run, in lower case', () => {
        const user = InvitedUserBuilder.regularUser('qa20').build(mailbox, '20261019-072315-k3f9');

        expect(user.email).toBe('team.qa-invite-20261019-072315-k3f9@inbox.example.test');
        expect(user).toMatchObject({ role: 'regular_user', warehouse: 'qa20', firstName: 'QA', lastName: 'Invite 20261019-072315-k3f9' });
        expect(InvitedUserBuilder.warehouseManager('qa20').build(mailbox).role).toBe('warehouse_manager');
    });

    test('every run gets a new password that passes the usual SSO policies', () => {
        const password = generateSsoPassword();

        expect(password).toHaveLength(20);
        for (const rule of [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]) {
            expect(password).toMatch(rule);
        }
        expect(generateSsoPassword()).not.toBe(password);
    });
});
