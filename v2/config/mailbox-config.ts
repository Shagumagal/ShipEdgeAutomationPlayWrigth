type Environment = Record<string, string | undefined>;

/** Default wait for an email: SMTP delivery in QA usually takes seconds, sometimes a couple of minutes. */
const DEFAULT_EMAIL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * MAILBOX_PROVIDER in lower case, or null when unset: the tests that read emails are skipped then,
 * so a checkout without a test inbox still runs the rest of the suite.
 */
export function mailboxProvider(env: Environment = process.env): string | null {
    return env.MAILBOX_PROVIDER?.trim().toLowerCase() || null;
}

/** INVITATION_EMAIL_TIMEOUT_MS as a whole number of 1 ms or more (3 minutes when unset). */
export function loadEmailTimeoutMs(env: Environment = process.env): number {
    const raw = env.INVITATION_EMAIL_TIMEOUT_MS?.trim();
    const value = raw ? Number(raw) : DEFAULT_EMAIL_TIMEOUT_MS;
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`INVITATION_EMAIL_TIMEOUT_MS must be a whole number of milliseconds; received "${raw}".`);
    }
    return value;
}

/** Reads provider settings, failing with the variables that are missing (Allure: "Missing environment configuration"). */
export function requireVariables<const T extends readonly string[]>(
    names: T,
    env: Environment = process.env,
): Record<T[number], string> {
    const missing = names.filter((name) => !env[name]?.trim());
    if (missing.length > 0) {
        throw new Error(
            `Missing required Xenvio environment variables: ${missing.join(', ')}. ` +
            `Add them to .env to use MAILBOX_PROVIDER=${mailboxProvider(env)} (see docs/19-user-invitation.md).`,
        );
    }
    return Object.fromEntries(names.map((name) => [name, env[name]!.trim()])) as Record<T[number], string>;
}
