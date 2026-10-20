/**
 * Parses the Xenvio invitation email. Pure module — no Playwright.
 *
 * Template: x5.xenvio app/views/devise/mailer/invitation_instructions.html.erb. The
 * "Accept invitation" button does not carry a Xenvio token: it points to the SSO (Keycloak), and
 * Xenvio recognizes the invitee by email when the SSO sends them back (User#keycloak_register_link):
 *  - email not registered in the SSO yet → .../protocol/openid-connect/registrations?...&login_hint=<email>
 *  - email already in the SSO            → .../protocol/openid-connect/auth?...&login_hint=<email>
 * In both, redirect_uri is <Xenvio>/users/auth/keycloakopenid/callback.
 */

import { ProductOutcomeError } from '../domain/contracts/product-contracts';

/** Subject of the invitation (x5.xenvio config/locales/devise_invitable.en.yml). */
export const INVITATION_SUBJECT = 'Invitation instructions';

const ACCEPT_LINK_TEXT = /accept invitation/i;
const SSO_CALLBACK_PATH = '/users/auth/keycloakopenid/callback';

export type InvitationFlow = 'register' | 'login';

export interface InvitationLink {
    /** Link of the "Accept invitation" button, ready to open. */
    readonly url: string;
    /** register → the SSO shows its sign-up form; login → the email already had an SSO account. */
    readonly flow: InvitationFlow;
    /** Email the SSO pre-fills; it must be the invited one. */
    readonly loginHint: string;
    /** Where the SSO sends the invitee back; it must be the Xenvio environment that invited them. */
    readonly redirectUri: string;
    /** Origin of the SSO, e.g. https://sso.omniorders.com */
    readonly ssoOrigin: string;
    /**
     * False when the path has empty segments ("//realms/..."): Keycloak rejects it with
     * {"error":"missingNormalization"}, so the invitee cannot accept. Seen when keycloak_site ends with "/".
     */
    readonly pathNormalized: boolean;
}

/** Extracts and decodes the "Accept invitation" link. Throws when the email does not have one. */
export function parseInvitationEmail(html: string): InvitationLink {
    const anchor = findAnchors(html).find(({ text }) => ACCEPT_LINK_TEXT.test(text));
    if (!anchor) {
        throw new ProductOutcomeError('The invitation email has no "Accept invitation" link');
    }

    let url: URL;
    try {
        url = new URL(anchor.href);
    } catch {
        throw new ProductOutcomeError(`The "Accept invitation" link is not a valid URL: ${anchor.href}`);
    }

    const flow = flowOf(url.pathname);
    if (!flow) {
        throw new ProductOutcomeError(`The "Accept invitation" link does not open the SSO sign-up or sign-in: ${anchor.href}`);
    }

    return {
        url: anchor.href,
        flow,
        loginHint: url.searchParams.get('login_hint') ?? '',
        redirectUri: url.searchParams.get('redirect_uri') ?? '',
        ssoOrigin: url.origin,
        pathNormalized: !url.pathname.includes('//'),
    };
}

/** True when the SSO will send the invitee back to the callback of `xenvioUrl`'s environment. */
export function returnsToXenvio(link: InvitationLink, xenvioUrl: string): boolean {
    return link.redirectUri === new URL(xenvioUrl).origin + SSO_CALLBACK_PATH;
}

function flowOf(pathname: string): InvitationFlow | null {
    if (pathname.endsWith('/protocol/openid-connect/registrations')) return 'register';
    if (pathname.endsWith('/protocol/openid-connect/auth')) return 'login';
    return null;
}

function findAnchors(html: string): Array<{ href: string; text: string }> {
    const anchors: Array<{ href: string; text: string }> = [];
    const pattern = /<a\b[^>]*?\bhref\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi;
    for (const [, , href, inner] of html.matchAll(pattern)) {
        anchors.push({
            href: decodeEntities(href.trim()),
            text: decodeEntities(inner.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(),
        });
    }
    return anchors;
}

function decodeEntities(value: string): string {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}
