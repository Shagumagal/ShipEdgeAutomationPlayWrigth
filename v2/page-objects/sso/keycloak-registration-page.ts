import { Locator, Page } from '@playwright/test';
import BasePage from '../base-page';
import type { InvitedUser } from '../../domain/users/xenvio-user';

/** What the SSO answered when the invitee opened a link: evidence for the invitation contracts. */
export interface SsoLinkAnswer {
    /** HTTP status of the page, or null when the browser got no response. */
    readonly status: number | null;
    /** Where the browser ended up. */
    readonly url: string;
    readonly title: string;
    readonly showsSignUpForm: boolean;
    /** Text the SSO shows instead of the form (e.g. {"error":"missingNormalization",...}); empty when the form shows. */
    readonly text: string;
}

/**
 * Page Object: sign-up form of the SSO (Keycloak), where an invited user lands from the
 * "Accept invitation" link of the email (parsers/invitation-email-parser.ts).
 *
 * Standard Keycloak registration form (realm "altacrest"): the email comes pre-filled from the
 * link's login_hint; the invitee types the password twice and their name. After "Register" the SSO
 * sends them back to Xenvio (/users/auth/keycloakopenid/callback).
 */
export class KeycloakRegistrationPage extends BasePage {

    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly passwordConfirmInput: Locator;
    readonly firstNameInput: Locator;
    readonly lastNameInput: Locator;
    readonly registerButton: Locator;
    readonly pageTitle: Locator;
    readonly errors: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.locator('input#email');
        this.passwordInput = page.locator('input#password');
        this.passwordConfirmInput = page.locator('input#password-confirm');
        this.firstNameInput = page.locator('input#firstName');
        this.lastNameInput = page.locator('input#lastName');
        this.registerButton = page.locator('input[type="submit"], button[type="submit"]').first();
        this.pageTitle = page.locator('#kc-page-title');
        // Field errors (input-error-*), the page alert and the feedback text of the Keycloak themes
        this.errors = page.locator('[id^="input-error"], .alert-error, .pf-m-danger, .kc-feedback-text');
    }

    /**
     * Opens `url` as the invitee would and reports what the SSO answered, form or error page. The
     * page stays there, so a failure screenshot shows exactly what the invitee saw.
     */
    async visit(url: string, timeoutMs = 30000): Promise<SsoLinkAnswer> {
        const response = await this.page.goto(url);
        // An error page is complete at once; only a successful answer is worth waiting for the form
        const showsSignUpForm = await this.isElementVisible(this.passwordInput, response?.ok() ? timeoutMs : 3000);
        const text = showsSignUpForm ? '' : (await this.page.locator('body').innerText().catch(() => '')).trim().slice(0, 500);
        return {
            status: response?.status() ?? null,
            url: this.page.url(),
            title: await this.page.title().catch(() => ''),
            showsSignUpForm,
            text,
        };
    }

    /** Opens the sign-up; if the SSO answers an error page instead of the form, throws with what it says. */
    async open(url: string): Promise<void> {
        const answer = await this.visit(url);
        if (!answer.showsSignUpForm) {
            throw new Error(`The SSO did not show its sign-up form for ${url}. It answered ${answer.status ?? 'nothing'}: ${answer.text || '(empty page)'}`);
        }
    }

    /** Email the form shows; the link must pre-fill it with the invited address. */
    prefilledEmail(): Promise<string> {
        return this.emailInput.inputValue();
    }

    /**
     * Submits the sign-up and waits until the SSO hands the invitee back to Xenvio. If the SSO keeps
     * them on its own pages (a rejected field, or an extra step such as verifying the email), it
     * throws with what the SSO shows instead of waiting for a Xenvio screen that never comes.
     */
    async register(user: Pick<InvitedUser, 'email' | 'firstName' | 'lastName' | 'password'>, timeoutMs = 60000): Promise<void> {
        if (!(await this.prefilledEmail())) {
            await this.type(this.emailInput, user.email);
        }
        await this.type(this.passwordInput, user.password);
        await this.type(this.passwordConfirmInput, user.password);
        await this.type(this.firstNameInput, user.firstName);
        await this.type(this.lastNameInput, user.lastName);

        const ssoOrigin = new URL(this.page.url()).origin;
        await this.click(this.registerButton);

        const outcome = await Promise.race([
            this.page.waitForURL((url) => url.origin !== ssoOrigin, { timeout: timeoutMs }).then(() => 'left' as const),
            this.errors.first().waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'error' as const),
        ]).catch(() => 'timeout' as const);

        if (outcome === 'left') return;

        const title = (await this.pageTitle.innerText().catch(() => '')).trim();
        const errors = (await this.errors.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
        throw new Error(
            `The SSO did not send the invitee back to Xenvio after "Register" (${outcome}). `
            + `Page: "${title || await this.page.title()}"${errors.length > 0 ? `; errors: ${errors.join(' | ')}` : ''}`,
        );
    }
}
