import { test, expect } from '@playwright/test';
import { TestmailMailbox, type TestmailHttp } from '../adapters/mail/testmail-mailbox';
import { createMailbox } from '../adapters/mail/mailbox-factory';

type Reply = { status: number; body?: unknown } | 'timeout';

/** Answers each GET with the next reply and records the query it received. */
function fakeHttp(replies: Reply[]) {
    const queries: Array<Record<string, unknown>> = [];
    const http: TestmailHttp = {
        get: (async (_url: string, options?: { params?: Record<string, unknown> }) => {
            queries.push(options?.params ?? {});
            const reply = replies.shift() ?? { status: 307 };
            if (reply === 'timeout') throw new Error('apiRequestContext.get: Timeout 80000ms exceeded.');
            return {
                status: () => reply.status,
                ok: () => reply.status >= 200 && reply.status < 300,
                json: async () => reply.body,
                text: async () => JSON.stringify(reply.body ?? ''),
            };
        }) as unknown as TestmailHttp['get'],
    };
    return { http, queries };
}

/** A clock where sleeping and every request move time forward, so timeouts run instantly. */
function fakeClock() {
    let now = 0;
    return { now: () => (now += 1_000), sleep: async (ms: number) => { now += ms; } };
}

const SETTINGS = { apiKey: 'test-key', namespace: 'abc12' };
const ADDRESS = 'abc12.qa-invite-20261019-072315-k3f9@inbox.testmail.app';
const invitation = { subject: 'Invitation instructions', from: 'Xenvio <no-reply@shipedge.com>', html: '<a href="x">Accept invitation</a>', timestamp: 5 };
const success = (emails: unknown[]) => ({ status: 200, body: { result: 'success', message: null, emails } });

test.describe('testmail.app mailbox', { tag: ['@unit', '@users'] }, () => {

    test('addresses are {namespace}.{tag}@inbox.testmail.app', () => {
        const mailbox = new TestmailMailbox(fakeHttp([]).http, SETTINGS);
        expect(mailbox.addressFor('qa-invite-20261019-072315-k3f9')).toBe(ADDRESS);
    });

    test('returns the matching email and asks for that tag with a live query', async () => {
        const { http, queries } = fakeHttp([success([invitation])]);
        const mailbox = new TestmailMailbox(http, SETTINGS, fakeClock());

        const message = await mailbox.waitForMessage(ADDRESS, { subject: 'Invitation instructions', timeoutMs: 60_000 });

        expect(message).toEqual({ subject: invitation.subject, from: invitation.from, html: invitation.html });
        expect(queries[0]).toMatchObject({ apikey: 'test-key', namespace: 'abc12', tag: 'qa-invite-20261019-072315-k3f9', livequery: 'true' });
    });

    test('keeps asking after "nothing yet" (307), a client timeout or a rate limit', async () => {
        const { http, queries } = fakeHttp([{ status: 307 }, 'timeout', { status: 429 }, success([invitation])]);
        const mailbox = new TestmailMailbox(http, SETTINGS, fakeClock());

        await mailbox.waitForMessage(ADDRESS, { subject: 'Invitation instructions', timeoutMs: 120_000 });
        expect(queries).toHaveLength(4);
    });

    test('ignores other emails to the tag and waits for newer ones', async () => {
        const other = { ...invitation, subject: 'Welcome', timestamp: 9 };
        const { http, queries } = fakeHttp([success([other]), success([invitation])]);
        const mailbox = new TestmailMailbox(http, SETTINGS, fakeClock());

        await mailbox.waitForMessage(ADDRESS, { subject: 'Invitation instructions', timeoutMs: 60_000 });
        expect(queries[1].timestamp_from).toBe(10);
    });

    test('fails clearly on timeout, on a rejected query and on an address of another inbox', async () => {
        const silent = new TestmailMailbox(fakeHttp([]).http, SETTINGS, fakeClock());
        await expect(silent.waitForMessage(ADDRESS, { subject: 'Invitation instructions', timeoutMs: 10_000 }))
            .rejects.toThrow(/No email with subject "Invitation instructions" reached .* within 10s/);

        const rejected = new TestmailMailbox(fakeHttp([{ status: 200, body: { result: 'fail', message: 'invalid apikey' } }]).http, SETTINGS, fakeClock());
        await expect(rejected.waitForMessage(ADDRESS, { subject: 'x', timeoutMs: 10_000 })).rejects.toThrow('invalid apikey');

        await expect(silent.waitForMessage('someone@yopmail.com', { subject: 'x', timeoutMs: 10_000 }))
            .rejects.toThrow(/not an inbox of the testmail.app namespace/);
    });

    test('MAILBOX_PROVIDER=testmail needs its API key and namespace', () => {
        const { http } = fakeHttp([]);
        expect(() => createMailbox(http as never, { MAILBOX_PROVIDER: 'testmail' }))
            .toThrow(/Missing required Xenvio environment variables: TESTMAIL_API_KEY, TESTMAIL_NAMESPACE/);
        expect(createMailbox(http as never, { MAILBOX_PROVIDER: 'TestMail', TESTMAIL_API_KEY: 'k', TESTMAIL_NAMESPACE: 'ABC12' }).addressFor('t'))
            .toBe('abc12.t@inbox.testmail.app');
        expect(() => createMailbox(http as never, { MAILBOX_PROVIDER: 'yopmail' })).toThrow(/Unknown MAILBOX_PROVIDER "yopmail". Supported: testmail/);
    });
});
