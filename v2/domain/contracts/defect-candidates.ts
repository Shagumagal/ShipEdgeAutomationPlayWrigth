/**
 * Turns the attempts of a run into product defect candidates. Pure module — no Playwright: the
 * reporter (diagnostics/defect-candidate-reporter.ts) feeds it plain records.
 *
 * Rules (docs/20-product-defect-candidates.md):
 *  - A candidate is a contract check that failed, never a confirmed bug.
 *  - Reproduction uses completed checks: infrastructure errors, even inside a reached check,
 *    neither confirm nor clear it, and are listed as other failures.
 *  - reproduced:           at least 2 attempts violated the contract and none passed it
 *  - pending-reproduction: a single violation, with no confirmed pass (e.g. --retries=0)
 *  - intermittent:         it failed in some attempts and passed in others; kept, with less weight
 *  - An empty list proves nothing about the product; the summary says so and states whether the
 *    run was complete.
 */
import { PRODUCT_CONTRACTS, type ProductContract } from './product-contracts';

export type AttemptStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
export type TestOutcome = 'expected' | 'unexpected' | 'flaky' | 'skipped';
export type RunStatus = 'passed' | 'failed' | 'timedout' | 'interrupted';
export type Reproduction = 'reproduced' | 'pending-reproduction' | 'intermittent';

export interface ContractViolationRecord {
    readonly id: string;
    /** The failed assertion or outcome, kept as evidence. */
    readonly message: string;
    /** Already redacted by whoever recorded it. */
    readonly evidence?: unknown;
}

export interface AttemptRecord {
    /** 0 for the first run; repeat-each runs of the same test are separate attempts with retry 0. */
    readonly retry: number;
    readonly status: AttemptStatus;
    /** Contract ids this attempt reached, in order. */
    readonly checked: readonly string[];
    /** Contract ids whose checks actually completed successfully. Reaching one is not a pass. */
    readonly passed: readonly string[];
    readonly violation: ContractViolationRecord | null;
    /** First line of the attempt's error, or null when it passed. */
    readonly error: string | null;
}

export interface TestRecord {
    readonly title: string;
    readonly file: string;
    readonly project: string;
    readonly outcome: TestOutcome;
    /** true when the test is marked test.fail() (failure expected because of a known bug). */
    readonly expectedToFail: boolean;
    /** Descriptions of the test's "issue" annotations (e.g. the ticket of a known bug). */
    readonly knownIssues: readonly string[];
    readonly attempts: readonly AttemptRecord[];
}

export interface RunRecord {
    readonly status: RunStatus;
    readonly startedAt: string;
    readonly durationMs: number;
    /** Effective retries per project (the CLI --retries overrides the config). */
    readonly retries: Readonly<Record<string, number>>;
    readonly repeatEach: Readonly<Record<string, number>>;
    readonly workers: number;
    readonly grep: readonly string[];
    /** Errors outside any test (global setup, a file that does not load). */
    readonly globalErrors: readonly string[];
}

export interface CandidateOccurrence {
    readonly test: string;
    readonly file: string;
    readonly project: string;
    readonly reproduction: Reproduction;
    /** Attempts that reached the check / failed exactly there / ran in total. */
    readonly reached: number;
    readonly violated: number;
    readonly passed: number;
    /** Reached, but no verdict: e.g. the API request threw or the test was interrupted. */
    readonly inconclusive: number;
    readonly attempts: number;
    /** Attempts that failed somewhere else, so they say nothing about this contract. */
    readonly otherFailures: ReadonlyArray<{ retry: number; error: string }>;
    readonly expectedToFail: boolean;
    readonly knownIssues: readonly string[];
    /** From the last attempt that failed the check. */
    readonly message: string;
    readonly evidence?: unknown;
}

export interface DefectCandidate {
    readonly status: 'candidate';
    readonly contract: string;
    readonly feature: string;
    readonly requirement: string;
    /** The strongest reproduction among the occurrences. */
    readonly reproduction: Reproduction;
    readonly occurrences: readonly CandidateOccurrence[];
}

export interface DefectCandidateReport {
    readonly schemaVersion: 1;
    readonly summary: string;
    readonly run: RunRecord & {
        /** False when the run was interrupted, timed out, or failed outside the tests. */
        readonly complete: boolean;
        readonly totals: Readonly<Record<TestOutcome, number>> & { readonly tests: number };
    };
    readonly candidates: readonly DefectCandidate[];
}

const STRENGTH: Record<Reproduction, number> = { reproduced: 3, 'pending-reproduction': 2, intermittent: 1 };

export function buildDefectCandidateReport(
    tests: readonly TestRecord[],
    run: RunRecord,
    catalog: Readonly<Record<string, ProductContract>> = PRODUCT_CONTRACTS,
): DefectCandidateReport {
    const occurrencesByContract = new Map<string, CandidateOccurrence[]>();
    for (const test of tests) {
        for (const [contract, occurrence] of occurrencesOf(test)) {
            occurrencesByContract.set(contract, [...(occurrencesByContract.get(contract) ?? []), occurrence]);
        }
    }

    const candidates: DefectCandidate[] = [...occurrencesByContract].map(([contract, occurrences]) => ({
        status: 'candidate',
        contract,
        feature: catalog[contract]?.feature ?? 'Unknown contract',
        requirement: catalog[contract]?.requirement ?? 'Not in the contract catalog (domain/contracts/product-contracts.ts)',
        reproduction: occurrences.map((o) => o.reproduction).reduce((a, b) => (STRENGTH[b] > STRENGTH[a] ? b : a)),
        occurrences,
    }));
    candidates.sort((a, b) => STRENGTH[b.reproduction] - STRENGTH[a.reproduction] || a.contract.localeCompare(b.contract));

    const totals = { tests: tests.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
    tests.forEach((test) => { totals[test.outcome]++; });

    const complete = (run.status === 'passed' || run.status === 'failed')
        && run.globalErrors.length === 0
        && !tests.some((test) => test.attempts.some((attempt) => attempt.status === 'interrupted'));

    return {
        schemaVersion: 1,
        summary: summarize(candidates, complete, run),
        run: { ...run, complete, totals },
        candidates,
    };
}

function occurrencesOf(test: TestRecord): Array<[string, CandidateOccurrence]> {
    const violatedIds = [...new Set(test.attempts.flatMap((a) => (a.violation ? [a.violation.id] : [])))];

    return violatedIds.map((contract) => {
        const reachedAttempts = test.attempts.filter((a) =>
            a.checked.includes(contract) || a.passed.includes(contract) || a.violation?.id === contract);
        const violatedAttempts = test.attempts.filter((a) => a.violation?.id === contract);
        const passedAttempts = test.attempts.filter((a) => a.passed.includes(contract) && a.violation?.id !== contract);
        const last = violatedAttempts[violatedAttempts.length - 1].violation!;

        const reached = reachedAttempts.length;
        const violated = violatedAttempts.length;
        const passed = passedAttempts.length;
        const reproduction: Reproduction = passed > 0 ? 'intermittent'
            : violated >= 2 ? 'reproduced'
                : 'pending-reproduction';

        const otherFailures = test.attempts
            .filter((a) => a.status !== 'passed' && a.status !== 'skipped' && a.violation?.id !== contract)
            .map((a) => ({ retry: a.retry, error: a.error ?? a.status }));

        return [contract, {
            test: test.title,
            file: test.file,
            project: test.project,
            reproduction,
            reached,
            violated,
            passed,
            inconclusive: reached - violated - passed,
            attempts: test.attempts.length,
            otherFailures,
            expectedToFail: test.expectedToFail,
            knownIssues: test.knownIssues,
            message: last.message,
            evidence: last.evidence,
        }];
    });
}

function summarize(candidates: readonly DefectCandidate[], complete: boolean, run: RunRecord): string {
    const scope = complete ? '' : ` The run is INCOMPLETE (${run.status}${run.globalErrors.length > 0 ? ', errors outside the tests' : ''}), so some checks may not have run.`;
    if (candidates.length === 0) {
        return `No product defect candidates were detected in this run. That does not prove the product has no defects.${scope}`;
    }
    const count = (reproduction: Reproduction) => candidates.filter((c) => c.reproduction === reproduction).length;
    return `${candidates.length} product defect candidate(s): ${count('reproduced')} reproduced, `
        + `${count('pending-reproduction')} pending reproduction, ${count('intermittent')} intermittent. `
        + `Candidates are not confirmed bugs: review the evidence before reporting.${scope}`;
}
