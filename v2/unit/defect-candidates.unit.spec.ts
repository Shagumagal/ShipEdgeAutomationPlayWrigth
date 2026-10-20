import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import type { FullConfig, FullResult, TestCase, TestResult } from '@playwright/test/reporter';
import {
    buildDefectCandidateReport,
    type AttemptRecord,
    type DefectCandidateReport,
    type RunRecord,
    type TestRecord,
} from '../domain/contracts/defect-candidates';
import { ProductOutcomeError } from '../domain/contracts/product-contracts';
import { contract, redactEvidence, type ContractRecorder } from '../diagnostics/product-contract';
import { CONTRACT_CHECKED, CONTRACT_PASSED, CONTRACT_VIOLATED, VIOLATION_ATTACHMENT } from '../diagnostics/product-defect-marks';
import DefectCandidateReporter from '../diagnostics/defect-candidate-reporter';

const LINK = 'invitation.link.sso-path-normalized';
const PENDING = 'invitation.user.pending-after-invite';

const RUN: RunRecord = {
    status: 'failed', startedAt: '2026-10-20T07:24:15.000Z', durationMs: 60000,
    retries: { 'xenvio-v2': 2 }, repeatEach: { 'xenvio-v2': 1 }, workers: 1, grep: ['/@users/'], globalErrors: [],
};

/** An attempt that reached `checked` and, when `violated` is given, failed exactly there. */
function attempt(retry: number, checked: string[], violated?: string, error?: string): AttemptRecord {
    const failed = Boolean(violated || error);
    return {
        retry,
        status: failed ? 'failed' : 'passed',
        checked,
        passed: error ? [] : checked.filter((id) => id !== violated),
        violation: violated ? { id: violated, message: `expect(received).toBe(expected) — attempt ${retry}`, evidence: { attempt: retry } } : null,
        error: violated ? `[PRODUCT DEFECT CANDIDATE] ${violated}` : error ?? null,
    };
}

function invitationTest(attempts: AttemptRecord[], extra: Partial<TestRecord> = {}): TestRecord {
    const failedLast = attempts[attempts.length - 1].status !== 'passed';
    const failedAny = attempts.some((a) => a.status !== 'passed');
    return {
        title: 'Xenvio User Invitation › TC-Xenvio-Users-001',
        file: 'v2/tests/xenvio-user-invitation.spec.ts',
        project: 'xenvio-v2',
        outcome: failedLast ? 'unexpected' : failedAny ? 'flaky' : 'expected',
        expectedToFail: false,
        knownIssues: [],
        attempts,
        ...extra,
    };
}

test.describe('Product defect candidates', { tag: ['@unit', '@defects'] }, () => {

    test('the same contract failing in every attempt is a reproduced candidate', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [PENDING, LINK], LINK),
            attempt(1, [PENDING, LINK], LINK),
            attempt(2, [PENDING, LINK], LINK),
        ])], RUN);

        expect(report.candidates).toHaveLength(1);
        expect(report.candidates[0]).toMatchObject({ status: 'candidate', contract: LINK, reproduction: 'reproduced', feature: 'User invitation' });
        expect(report.candidates[0].occurrences[0]).toMatchObject({ reached: 3, violated: 3, attempts: 3, otherFailures: [] });
        expect(report.candidates[0].occurrences[0].evidence).toEqual({ attempt: 2 }); // from the last failed attempt
        expect(report.summary).toMatch(/^1 product defect candidate\(s\): 1 reproduced, 0 pending reproduction, 0 intermittent\. Candidates are not confirmed bugs/);
    });

    test('attempts that failed for another cause neither confirm nor clear the contract', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [PENDING, LINK], LINK),
            attempt(1, [], undefined, 'TimeoutError: waiting for input#user_email'), // login never got to the check
            attempt(2, [PENDING], undefined, 'No email with subject "Invitation instructions" reached ...'),
        ])], RUN);

        const [occurrence] = report.candidates[0].occurrences;
        expect(report.candidates[0].reproduction).toBe('pending-reproduction');
        expect(occurrence).toMatchObject({ reached: 1, violated: 1, attempts: 3 });
        expect(occurrence.otherFailures).toEqual([
            { retry: 1, error: 'TimeoutError: waiting for input#user_email' },
            { retry: 2, error: 'No email with subject "Invitation instructions" reached ...' },
        ]);
    });

    test('two attempts failing on different contracts are two separate, unreproduced candidates', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [PENDING], PENDING),
            attempt(1, [PENDING, LINK], LINK),
        ])], RUN);

        expect(report.candidates.map((c) => [c.contract, c.reproduction])).toEqual([
            [LINK, 'pending-reproduction'],
            // attempt 1 passed the pending check, so that one failed only sometimes
            [PENDING, 'intermittent'],
        ]);
    });

    test('a failure that passes on a retry is kept as intermittent, not discarded', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [PENDING, LINK], LINK),
            attempt(1, [PENDING, LINK]),
        ])], RUN);

        expect(report.candidates[0]).toMatchObject({ contract: LINK, reproduction: 'intermittent' });
        expect(report.candidates[0].occurrences[0]).toMatchObject({ reached: 2, violated: 1 });
        expect(report.run.totals).toMatchObject({ tests: 1, flaky: 1 });
    });

    test('an infrastructure error inside a reached contract does not count as a recovery', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [LINK], LINK),
            attempt(1, [LINK], undefined, 'GET /users → HTTP 502: Bad Gateway'),
        ])], RUN);

        expect(report.candidates[0].reproduction).toBe('pending-reproduction');
        expect(report.candidates[0].occurrences[0]).toMatchObject({
            reached: 2, violated: 1, passed: 0, inconclusive: 1, attempts: 2,
            otherFailures: [{ retry: 1, error: 'GET /users → HTTP 502: Bad Gateway' }],
        });
    });

    test('two violations remain reproduced when another reached attempt was interrupted', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [LINK], LINK),
            { ...attempt(1, [LINK], undefined, 'Run interrupted'), status: 'interrupted' },
            attempt(2, [LINK], LINK),
        ])], { ...RUN, status: 'interrupted' });

        expect(report.candidates[0].reproduction).toBe('reproduced');
        expect(report.candidates[0].occurrences[0]).toMatchObject({ reached: 3, violated: 2, passed: 0, inconclusive: 1 });
        expect(report.run.complete).toBe(false);
    });

    test('a passed contract still counts when a later step fails', () => {
        const report = buildDefectCandidateReport([invitationTest([
            attempt(0, [LINK], LINK),
            { ...attempt(1, [LINK], undefined, 'TimeoutError: waiting for locator'), passed: [LINK] },
        ])], RUN);

        expect(report.candidates[0].reproduction).toBe('intermittent');
        expect(report.candidates[0].occurrences[0]).toMatchObject({ reached: 2, violated: 1, passed: 1, inconclusive: 0 });
    });

    test('a single run (--retries=0) is pending reproduction', () => {
        const report = buildDefectCandidateReport([invitationTest([attempt(0, [PENDING, LINK], LINK)])], { ...RUN, retries: { 'xenvio-v2': 0 } });

        expect(report.candidates[0].reproduction).toBe('pending-reproduction');
        expect(report.run.retries).toEqual({ 'xenvio-v2': 0 });
    });

    test('no candidates is not "no bugs", and an incomplete run says so', () => {
        const clean = buildDefectCandidateReport([invitationTest([attempt(0, [PENDING, LINK])])], { ...RUN, status: 'passed' });
        expect(clean.candidates).toEqual([]);
        expect(clean.run.complete).toBe(true);
        expect(clean.summary).toBe('No product defect candidates were detected in this run. That does not prove the product has no defects.');

        const interrupted = buildDefectCandidateReport([invitationTest([{ ...attempt(0, [PENDING]), status: 'interrupted' }])], { ...RUN, status: 'interrupted' });
        expect(interrupted.run.complete).toBe(false);
        expect(interrupted.summary).toMatch(/The run is INCOMPLETE \(interrupted\)/);

        const setupFailed = buildDefectCandidateReport([], { ...RUN, globalErrors: ['Error in global setup'] });
        expect(setupFailed.run.complete).toBe(false);
        expect(setupFailed.summary).toMatch(/errors outside the tests/);
    });

    test('a test marked as failing for a known bug keeps its ticket on the candidate', () => {
        const report = buildDefectCandidateReport([invitationTest(
            [attempt(0, [LINK], LINK), attempt(1, [LINK], LINK)],
            { expectedToFail: true, knownIssues: ['https://app.clickup.com/t/abc123'], outcome: 'expected' },
        )], RUN);

        expect(report.candidates[0].occurrences[0]).toMatchObject({ expectedToFail: true, knownIssues: ['https://app.clickup.com/t/abc123'] });
    });
});

test.describe('Product contract checks', { tag: ['@unit', '@defects'] }, () => {
    /** Collects the marks instead of writing them to this unit test's own result. */
    function recorder() {
        const attachments: Array<{ name: string; body: string }> = [];
        const info = {
            annotations: [] as Array<{ type: string; description?: string }>,
            attach: async (name: string, options: { body?: string | Buffer }) => { attachments.push({ name, body: String(options.body) }); },
        } as unknown as ContractRecorder & { annotations: Array<{ type: string; description?: string }> };
        return { info, attachments };
    }

    test('a passing check marks the contract as reached and returns the value', async () => {
        const { info, attachments } = recorder();
        expect(await contract(LINK, () => 42, undefined, info)).toBe(42);
        expect(info.annotations).toEqual([
            { type: CONTRACT_CHECKED, description: LINK },
            { type: CONTRACT_PASSED, description: LINK },
        ]);
        expect(attachments).toEqual([]);
    });

    test('a failed expect becomes a tagged candidate with its redacted evidence', async () => {
        const { info, attachments } = recorder();
        const evidence = { link: 'https://sso.example.test//realms/x/registrations?client_id=xenvio&invitation_token=abc123&login_hint=qa@x.test', apiKey: 'secret' };

        const error = await contract(LINK, () => expect(false, 'path must be normalized').toBe(true), evidence, info).catch((e: Error) => e);

        expect(error?.message).toMatch(/^\[PRODUCT DEFECT CANDIDATE\] invitation\.link\.sso-path-normalized: The "Accept invitation" link has a normalized path/);
        expect(error?.message).toContain('path must be normalized'); // the original assertion stays
        expect(info.annotations.map((a) => a.type)).toEqual([CONTRACT_CHECKED, CONTRACT_VIOLATED]);

        const violation = JSON.parse(attachments.find((a) => a.name === VIOLATION_ATTACHMENT)!.body);
        expect(violation.id).toBe(LINK);
        expect(violation.evidence.link).toContain('invitation_token=[REDACTED]');
        expect(violation.evidence.link).toContain('login_hint=qa@x.test');
        expect(violation.evidence.apiKey).toBe('[REDACTED]');
    });

    test('expect.poll and a ProductOutcomeError also count as violations', async () => {
        for (const check of [
            () => expect.poll(() => 'pending', { timeout: 200, intervals: [50] }).toBe('inactive'),
            () => { throw new ProductOutcomeError('No email with subject "Invitation instructions" reached qa@x.test within 180s'); },
        ]) {
            const { info } = recorder();
            const error = await contract(PENDING, check, undefined, info).catch((e: Error) => e);
            expect(error?.message, String(check)).toMatch(/^\[PRODUCT DEFECT CANDIDATE\] invitation\.user\.pending-after-invite/);
            expect(info.annotations.map((a) => a.type)).toEqual([CONTRACT_CHECKED, CONTRACT_VIOLATED]);
        }
    });

    test('expect.poll with the invitation custom message still records a violation', async () => {
        const { info, attachments } = recorder();
        const error = await contract('invitation.user.inactive-after-accept', () => expect.poll(() => 'pending', {
            message: 'backend status after accepting the invitation',
            timeout: 200,
            intervals: [25],
        }).toBe('inactive'), { expected: 'inactive' }, info).catch((e: Error) => e);

        expect(error?.message).toContain('[PRODUCT DEFECT CANDIDATE] invitation.user.inactive-after-accept');
        expect(error?.message).toContain('backend status after accepting the invitation');
        expect(JSON.parse(attachments[0].body).id).toBe('invitation.user.inactive-after-accept');
    });

    test('a provider exception inside expect.poll is still an infrastructure failure', async () => {
        const { info, attachments } = recorder();
        const original = new Error('GET /users → HTTP 502: Bad Gateway');
        const error = await contract(PENDING, () => expect.poll(() => { throw original; }, {
            message: 'backend status after accepting the invitation',
            timeout: 200,
            intervals: [25],
        }).toBe('inactive'), undefined, info).catch((e: Error) => e);

        expect(error).toBe(original);
        expect(info.annotations.map((a) => a.type)).toEqual([CONTRACT_CHECKED]);
        expect(attachments).toEqual([]);
    });

    test('tokens in assertion messages are removed from the attachment, error and stack', async () => {
        const { info, attachments } = recorder();
        const secret = 'synthetic-review-token';
        const link = `https://sso.example.test//realms?invitation_token=${secret}&state=${secret}`;
        const error = await contract(LINK,
            () => expect(false, `Malformed invitation: ${link}`).toBe(true),
            { link }, info).catch((e: Error) => e);

        const violation = JSON.parse(attachments[0].body);
        expect(violation.message).toContain('invitation_token=[REDACTED]');
        expect(violation.message).toContain('//realms');
        for (const text of [attachments[0].body, error?.message, error?.stack]) {
            expect(text).not.toContain(secret);
        }
    });

    test('any other error fails as usual but is not a candidate (a selector timeout, a 5xx)', async () => {
        const { info, attachments } = recorder();
        const original = new Error('GET /shipper/xenvio_users → HTTP 502: Bad Gateway');

        const error = await contract(PENDING, () => { throw original; }, undefined, info).catch((e: Error) => e);

        expect(error).toBe(original);
        expect(error?.message).toBe('GET /shipper/xenvio_users → HTTP 502: Bad Gateway');
        expect(info.annotations.map((a) => a.type)).toEqual([CONTRACT_CHECKED]);
        expect(attachments).toEqual([]);
    });

    test('evidence redaction keeps the proof and masks credentials and one-time tokens', () => {
        expect(redactEvidence({ url: 'https://x.test/cb?code=abc&state=def&response_type=code', password: 'p' }))
            .toEqual({ url: 'https://x.test/cb?code=[REDACTED]&state=[REDACTED]&response_type=code', password: '[REDACTED]' });
        expect(redactEvidence(undefined)).toBeNull();
    });
});

test.describe('Defect candidate reporter', { tag: ['@unit', '@defects'] }, () => {

    /** A finished attempt as Playwright reports it, with the marks contract() leaves. */
    function result(retry: number, violated: boolean): TestResult {
        const violation = { id: LINK, message: 'expect(received).toBe(expected)', evidence: { link: 'https://sso//realms' } };
        return {
            retry,
            status: violated ? 'failed' : 'passed',
            annotations: [
                { type: CONTRACT_CHECKED, description: LINK },
                { type: violated ? CONTRACT_VIOLATED : CONTRACT_PASSED, description: LINK },
            ],
            attachments: violated ? [{ name: VIOLATION_ATTACHMENT, contentType: 'application/json', body: Buffer.from(JSON.stringify(violation)) }] : [],
            error: violated ? { message: `\u001b[31m[PRODUCT DEFECT CANDIDATE] ${LINK}\u001b[39m\nexpect(received)` } : undefined,
        } as unknown as TestResult;
    }

    function testCase(id: string, outcome: ReturnType<TestCase['outcome']>, project = 'xenvio-v2'): TestCase {
        return {
            id,
            expectedStatus: 'passed',
            annotations: [],
            location: { file: '/repo/v2/tests/xenvio-user-invitation.spec.ts', line: 37, column: 9 },
            parent: { project: () => ({ name: project }) },
            titlePath: () => ['', 'xenvio-v2', 'xenvio-user-invitation.spec.ts', 'Xenvio User Invitation', 'TC-Xenvio-Users-001'],
            outcome: () => outcome,
        } as unknown as TestCase;
    }

    function run(feed: (reporter: DefectCandidateReporter) => void, retries = 0, repeatEach = 1): DefectCandidateReport {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'defects-'));
        const reporter = new DefectCandidateReporter({ outputFile: 'defect-candidates.json', print: false });
        reporter.onBegin({
            rootDir: '/repo', configFile: path.join(dir, 'playwright.config.ts'), workers: 1,
            projects: [{ name: 'xenvio-v2', retries, repeatEach, grep: /@users/ }],
        } as unknown as FullConfig, {} as never);
        feed(reporter);
        reporter.onEnd({ status: 'failed', duration: 1000 } as FullResult);
        const report = JSON.parse(fs.readFileSync(path.join(dir, 'defect-candidates.json'), 'utf8'));
        fs.rmSync(dir, { recursive: true, force: true });
        return report;
    }

    test('a run without tests of the watched projects (unit tests, the purge) keeps the last file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'defects-'));
        const file = path.join(dir, 'latest.json');
        fs.writeFileSync(file, '{"previous":"e2e run"}');

        const reporter = new DefectCandidateReporter({ outputFile: 'latest.json', print: false, projects: ['xenvio-v2'] });
        reporter.onBegin({
            rootDir: '/repo', configFile: path.join(dir, 'playwright.config.ts'), workers: 1,
            projects: [{ name: 'unit', retries: 0, repeatEach: 1, grep: /.*/ }],
        } as unknown as FullConfig, {} as never);
        reporter.onTestEnd(testCase('u1', 'expected', 'unit'), result(0, false));
        reporter.onEnd({ status: 'passed', duration: 1000 } as FullResult);

        expect(fs.readFileSync(file, 'utf8')).toBe('{"previous":"e2e run"}');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('records the effective retries and counts every retry as an attempt', () => {
        const report = run((reporter) => {
            const tc = testCase('t1', 'unexpected');
            reporter.onTestEnd(tc, result(0, true));
            reporter.onTestEnd(tc, result(1, true));
        }, 1);

        expect(report.run.retries).toEqual({ 'xenvio-v2': 1 });
        expect(report.run.grep).toEqual(['/@users/']);
        expect(report.candidates[0]).toMatchObject({ contract: LINK, reproduction: 'reproduced' });
        expect(report.candidates[0].occurrences[0]).toMatchObject({ file: 'v2/tests/xenvio-user-invitation.spec.ts', reached: 2, violated: 2 });
    });

    test('real contract records survive the reporter without leaking tokens or inventing a pass', async () => {
        const recorded: TestResult[] = [];
        const secret = 'reporter-synthetic-secret';
        for (const [retry, check] of [
            () => expect(false, `Broken link https://sso.test//realms?token=${secret}`).toBe(true),
            () => { throw new Error('GET /users → HTTP 502: Bad Gateway'); },
        ].entries()) {
            const annotations: TestResult['annotations'] = [];
            const attachments: TestResult['attachments'] = [];
            const info: ContractRecorder = {
                annotations,
                attach: async (name, options) => {
                    attachments.push({ name, contentType: options?.contentType ?? '', body: Buffer.from(options?.body ?? '') });
                },
            };
            const error = await contract(LINK, check, { link: `https://sso.test//realms?token=${secret}` }, info)
                .catch((e: Error) => e);
            recorded.push({
                ...result(retry, true), annotations, attachments,
                error: error instanceof Error ? { message: error.message, stack: error.stack } : undefined,
            });
        }
        const report = run((reporter) => {
            for (const attemptResult of recorded) reporter.onTestEnd(testCase('t1', 'unexpected'), attemptResult);
        }, 1);

        expect(report.candidates[0].reproduction).toBe('pending-reproduction');
        expect(report.candidates[0].occurrences[0]).toMatchObject({
            reached: 2, violated: 1, passed: 0, inconclusive: 1,
            otherFailures: [{ retry: 1, error: 'GET /users → HTTP 502: Bad Gateway' }],
        });
        expect(JSON.stringify(report)).not.toContain(secret);
    });

    test('repeat-each copies of a test are attempts of the same test (--repeat-each=3)', () => {
        const report = run((reporter) => {
            reporter.onTestEnd(testCase('copy-0', 'unexpected'), result(0, true));
            reporter.onTestEnd(testCase('copy-1', 'unexpected'), result(0, true));
            reporter.onTestEnd(testCase('copy-2', 'expected'), result(0, false));
        }, 0, 3);

        expect(report.run.totals).toMatchObject({ tests: 1, unexpected: 1 });
        expect(report.candidates[0]).toMatchObject({ reproduction: 'intermittent' });
        expect(report.candidates[0].occurrences[0]).toMatchObject({ reached: 3, violated: 2, attempts: 3 });
    });
});
