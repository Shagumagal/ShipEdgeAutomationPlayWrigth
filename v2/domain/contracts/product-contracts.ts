/**
 * Product contracts: requirements a test checks against data the product produced (a backend
 * answer, an email, a link), not against a selector. Pure module — no Playwright.
 *
 * A failed contract check makes the failure a product defect CANDIDATE, never a confirmed bug: the
 * test itself can be wrong too. diagnostics/product-contract.ts runs the checks and
 * diagnostics/defect-candidate-reporter.ts gathers them per run (docs/20-product-defect-candidates.md).
 *
 * Ids are stable: the reporter counts how many attempts reached a check and failed exactly there,
 * so an id never carries run data (emails, ids). Add new contracts here instead of inventing an id
 * in a spec, so the same requirement always has the same id.
 */
export interface ProductContract {
    readonly feature: string;
    /** The expected behavior, written so it can go as is into a bug report. */
    readonly requirement: string;
}

export const PRODUCT_CONTRACTS = Object.freeze({
    'invitation.user.pending-after-invite': {
        feature: 'User invitation',
        requirement: 'Right after the invitation, Xenvio lists the user as Pending with the chosen role and facility.',
    },
    'invitation.email.delivered': {
        feature: 'User invitation',
        requirement: 'The invitation email, with an "Accept invitation" link, reaches the invited address.',
    },
    'invitation.link.sso-path-normalized': {
        feature: 'User invitation',
        requirement: 'The "Accept invitation" link has a normalized path that the SSO accepts (no empty segments such as "//realms").',
    },
    'invitation.link.opens-sso-signup': {
        feature: 'User invitation',
        requirement: 'Opening the "Accept invitation" link shows the SSO sign-up form to the invitee.',
    },
    'invitation.link.register-flow': {
        feature: 'User invitation',
        requirement: 'An address with no SSO account gets the SSO sign-up, not the sign-in.',
    },
    'invitation.link.login-hint': {
        feature: 'User invitation',
        requirement: 'The "Accept invitation" link pre-fills the invited email in the SSO.',
    },
    'invitation.link.returns-to-xenvio': {
        feature: 'User invitation',
        requirement: 'The SSO sends the invitee back to the callback of the Xenvio environment that invited them.',
    },
    'invitation.user.inactive-after-accept': {
        feature: 'User invitation',
        requirement: 'After the invitee accepts, Xenvio lists the user as Inactive (accepted, waiting for an admin to activate it).',
    },
} as const satisfies Record<string, ProductContract>);

export type ContractId = keyof typeof PRODUCT_CONTRACTS;

/**
 * Thrown by product-facing code when the product did not produce an expected outcome (an email
 * that never arrived, an email without its link). Inside a contract check it counts as a violation,
 * like a failed expect. Any other error (a timeout waiting for a selector, a 5xx, a provider
 * outage) still fails the test but is not enough on its own to make a candidate.
 */
export class ProductOutcomeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProductOutcomeError';
    }
}
