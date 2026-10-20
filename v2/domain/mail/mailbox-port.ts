/**
 * Port to a test inbox. Pure module — no Playwright.
 *
 * Tests ask for an address and wait for a message without knowing the provider behind it, so the
 * provider (an email-testing API, an SMTP sink in QA, ...) is replaced by writing a new adapter
 * under v2/adapters/mail, with no change to services or scenarios.
 */
export interface MailMessage {
    readonly subject: string;
    readonly from: string;
    readonly html: string;
}

export interface MailQuery {
    /** Subject of the expected message; a string must match exactly (case-insensitive). */
    readonly subject: string | RegExp;
    readonly timeoutMs: number;
}

export interface MailboxPort {
    /** Provider name shown in logs and in the report. */
    readonly name: string;

    /**
     * Address of an inbox only this test reads. `tag` must already be unique per run (e.g. it
     * carries an automationStamp); the provider decides the rest of the address.
     */
    addressFor(tag: string): string;

    /** Resolves with the first message to `address` whose subject matches; rejects on timeout. */
    waitForMessage(address: string, query: MailQuery): Promise<MailMessage>;
}

/** True when `subject` is the one `query` expects. Shared by every adapter. */
export function subjectMatches(subject: string, expected: string | RegExp): boolean {
    return typeof expected === 'string'
        ? subject.trim().toLowerCase() === expected.trim().toLowerCase()
        : expected.test(subject);
}
