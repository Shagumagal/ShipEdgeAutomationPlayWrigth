import { Locator, Page } from '@playwright/test';
import BasePage from '../base-page';
import type { InvitedUser } from '../../domain/users/xenvio-user';

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

    /** Opens the sign-up; if the SSO answers an error page instead of the form, throws with what it says. */
    async open(url: string): Promise<void> {
        await this.page.goto(url);
        if (!(await this.isElementVisible(this.passwordInput, 30000))) {
            const shown = (await this.page.locator('body').innerText().catch(() => '')).trim().slice(0, 300);
            throw new Error(`The SSO did not show its sign-up form for ${url}. It shows: ${shown || '(empty page)'}`);
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
