import type { APIRequestContext } from '@playwright/test';
import { requireVariables } from '../../config/mailbox-config';
import { subjectMatches, type MailboxPort, type MailMessage, type MailQuery } from '../../domain/mail/mailbox-port';

type Environment = Record<string, string | undefined>;

const API_URL = 'https://api.testmail.app/api/json';
const DOMAIN = 'inbox.testmail.app';
/** testmail.app holds a live query about a minute before answering 307 "nothing yet". */
const LIVE_QUERY_MS = 75_000;
const RATE_LIMIT_PAUSE_MS = 5_000;

/** The part of APIRequestContext the adapter uses (a fake in unit tests). */
export type TestmailHttp = Pick<APIRequestContext, 'get'>;

interface TestmailEmail {
    subject: string;
    from: string;
    html?: string;
    text?: string;
    timestamp: number;
}

interface TestmailAnswer {
    result: 'success' | 'fail';
    message: string | null;
    emails?: TestmailEmail[];
}

export interface TestmailSettings {
    apiKey: string;
    namespace: string;
}

/**
 * MailboxPort over testmail.app (https://testmail.app/docs/). Every address of the namespace
 * already exists — `{namespace}.{tag}@inbox.testmail.app` — so a test only picks a unique tag;
 * nothing is created or deleted on the provider. Emails are read with the JSON API's live query,
 * which answers as soon as a matching email arrives.
 *
 * MAILBOX_PROVIDER=testmail, TESTMAIL_API_KEY, TESTMAIL_NAMESPACE.
 */
export class TestmailMailbox implements MailboxPort {
    readonly name = 'testmail.app';

    constructor(
        private readonly http: TestmailHttp,
        private readonly settings: TestmailSettings,
        private readonly clock: { now(): number; sleep(ms: number): Promise<void> } = {
            now: () => Date.now(),
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        },
    ) {}

    static fromEnv(http: TestmailHttp, env: Environment): TestmailMailbox {
        const vars = requireVariables(['TESTMAIL_API_KEY', 'TESTMAIL_NAMESPACE'], env);
        return new TestmailMailbox(http, { apiKey: vars.TESTMAIL_API_KEY, namespace: vars.TESTMAIL_NAMESPACE.toLowerCase() });
    }

    addressFor(tag: string): string {
        return `${this.settings.namespace}.${tag.toLowerCase()}@${DOMAIN}`;
    }

    async waitForMessage(address: string, query: MailQuery): Promise<MailMessage> {
        const tag = this.tagOf(address);
        const deadline = this.clock.now() + query.timeoutMs;
        let since = 0; // the tag is unique per run, so every email it has is this run's

        while (this.clock.now() < deadline) {
            const remaining = deadline - this.clock.now();
            const response = await this.http.get(API_URL, {
                params: {
                    apikey: this.settings.apiKey,
                    namespace: this.settings.namespace,
                    tag,
                    livequery: 'true',
                    timestamp_from: since,
                    limit: 100,
                },
                timeout: Math.min(remaining, LIVE_QUERY_MS) + 5_000,
                maxRedirects: 0, // 307 = nothing arrived during this live query: ask again ourselves
                failOnStatusCode: false,
            }).catch((error: Error) => {
                // The live query outlived our own wait: treat it as "nothing yet"
                if (/timeout/i.test(error.message)) return null;
                throw error;
            });

            if (!response || response.status() === 307) {
                await this.clock.sleep(1_000); // never hammer the API if it answers 307 at once
                continue;
            }
            if (response.status() === 429) {
                await this.clock.sleep(RATE_LIMIT_PAUSE_MS);
                continue;
            }
            if (!response.ok()) {
                throw new Error(`testmail.app answered HTTP ${response.status()}: ${(await response.text()).slice(0, 200)}`);
            }

            const answer = await response.json() as TestmailAnswer;
            if (answer.result !== 'success') {
                throw new Error(`testmail.app rejected the query: ${answer.message ?? 'no reason given'}`);
            }

            const emails = answer.emails ?? [];
            const match = emails.find((email) => subjectMatches(email.subject, query.subject));
            if (match) {
                return { subject: match.subject, from: match.from, html: match.html || match.text || '' };
            }
            // Only other emails so far: wait for newer ones
            if (emails.length > 0) since = Math.max(...emails.map((email) => email.timestamp)) + 1;
        }

        throw new Error(`No email with subject "${query.subject}" reached ${address} within ${Math.round(query.timeoutMs / 1000)}s (testmail.app)`);
    }

    private tagOf(address: string): string {
        const prefix = `${this.settings.namespace}.`;
        const [local, domain] = address.toLowerCase().split('@');
        if (domain !== DOMAIN || !local.startsWith(prefix)) {
            throw new Error(`${address} is not an inbox of the testmail.app namespace "${this.settings.namespace}"`);
        }
        return local.slice(prefix.length);
    }
}
