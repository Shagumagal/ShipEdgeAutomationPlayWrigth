import type { APIRequestContext } from '@playwright/test';
import { mailboxProvider } from '../../config/mailbox-config';
import type { MailboxPort } from '../../domain/mail/mailbox-port';
import { TestmailMailbox } from './testmail-mailbox';

type Environment = Record<string, string | undefined>;

/** Builds a mailbox adapter; it reads its own settings from `env` and calls its API with `request`. */
export type MailboxFactory = (request: APIRequestContext, env: Environment) => MailboxPort;

/**
 * One entry per supported provider, keyed by the MAILBOX_PROVIDER value. Adding a provider means
 * writing its adapter next to this file and registering it here; nothing else changes.
 *
 * yopmail is deliberately not here: its web inbox sits behind a Cloudflare "Verify you are human"
 * check for automated browsers, which a test must not try to get around.
 */
export const MAILBOX_PROVIDERS: Readonly<Record<string, MailboxFactory>> = Object.freeze({
    testmail: (request, env) => TestmailMailbox.fromEnv(request, env),
});

/** The mailbox selected by MAILBOX_PROVIDER. `request` is owned (and disposed) by the caller. */
export function createMailbox(request: APIRequestContext, env: Environment = process.env): MailboxPort {
    const provider = mailboxProvider(env);
    if (!provider) {
        throw new Error(
            'Missing required Xenvio environment variables: MAILBOX_PROVIDER. ' +
            'Set the test inbox provider in .env (see docs/19-user-invitation.md).',
        );
    }

    const factory = MAILBOX_PROVIDERS[provider];
    if (!factory) {
        const supported = Object.keys(MAILBOX_PROVIDERS).join(', ') || 'none yet';
        throw new Error(`Unknown MAILBOX_PROVIDER "${provider}". Supported: ${supported}.`);
    }
    return factory(request, env);
}
