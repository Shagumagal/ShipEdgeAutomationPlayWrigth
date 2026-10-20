import * as fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult } from '@playwright/test/reporter';
import {
    buildDefectCandidateReport,
    type AttemptRecord,
    type ContractViolationRecord,
    type DefectCandidateReport,
    type TestRecord,
} from '../domain/contracts/defect-candidates';
import { CONTRACT_CHECKED, CONTRACT_PASSED, stripAnsi, VIOLATION_ATTACHMENT } from './product-defect-marks';

interface Options {
    /**
     * Relative to the config file. Kept outside test-results/, which Playwright empties at the start
     * of every run, so a later run (unit tests, the purge) does not erase it.
     */
    outputFile?: string;
    /**
     * Only tests of these projects count, and the file is written only when the run executed some
     * (default: every project). A run of other projects leaves the last file as it was.
     */
    projects?: string[];
    /** Print the summary when there are candidates or the run is incomplete (default true). */
    print?: boolean;
}

type MutableTestRecord = Omit<TestRecord, 'attempts' | 'outcome' | 'knownIssues'> & {
    attempts: AttemptRecord[];
    knownIssues: string[];
    /** Latest test.outcome() of each test case (one per repeat-each copy). */
    outcomes: Map<string, TestRecord['outcome']>;
};

/**
 * Gathers the product contract checks of every attempt (all workers, every retry and repeat-each
 * run) and, when the run ends, writes them as product defect candidates to
 * defect-candidates/latest.json (domain/contracts/defect-candidates.ts has the rules).
 *
 * Runs in the runner process, so no two workers ever write the file. It never changes a result
 * and never sends anything anywhere: the file is local, and a report is prepared only on request
 * (docs/20-product-defect-candidates.md).
 */
export default class DefectCandidateReporter implements Reporter {
    private config!: FullConfig;
    private startedAt = new Date();
    private readonly tests = new Map<string, MutableTestRecord>();
    private readonly globalErrors: string[] = [];

    constructor(private readonly options: Options = {}) {}

    onBegin(config: FullConfig, _suite: Suite): void {
        this.config = config;
        this.startedAt = new Date();
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        // repeat-each copies of a test have their own id: group them so they count as attempts
        const project = test.parent.project()?.name ?? '';
        if (this.options.projects && !this.options.projects.includes(project)) return;
        const file = path.relative(this.config.rootDir, test.location.file);
        const key = [project, file, ...test.titlePath().slice(3)].join(' › ');

        const record: MutableTestRecord = this.tests.get(key) ?? {
            title: test.titlePath().slice(3).join(' › '),
            file,
            project,
            expectedToFail: test.expectedStatus === 'failed',
            knownIssues: [],
            attempts: [],
            outcomes: new Map(),
        };
        record.attempts.push(toAttempt(result));
        record.outcomes.set(test.id, test.outcome()); // the outcome after this attempt considers the earlier ones
        record.knownIssues = test.annotations.filter((a) => a.type === 'issue').map((a) => a.description ?? 'issue');
        this.tests.set(key, record);
    }

    onError(error: TestError): void {
        this.globalErrors.push(firstLine(error.message ?? error.value ?? 'unknown error'));
    }

    onEnd(result: FullResult): void {
        // Nothing of the watched projects ran: keep the last file instead of replacing it with an empty run
        if (this.tests.size === 0) return;

        const tests: TestRecord[] = [...this.tests.values()].map(({ outcomes, ...record }) => ({
            ...record,
            outcome: combineOutcomes([...outcomes.values()]),
        }));
        const report = buildDefectCandidateReport(tests, {
            status: result.status,
            startedAt: this.startedAt.toISOString(),
            durationMs: result.duration,
            retries: Object.fromEntries(this.config.projects.map((p) => [p.name, p.retries])),
            repeatEach: Object.fromEntries(this.config.projects.map((p) => [p.name, p.repeatEach])),
            workers: this.config.workers,
            grep: this.config.projects.flatMap((p) => [p.grep].flat().map(String)).filter((g, i, all) => all.indexOf(g) === i),
            globalErrors: this.globalErrors,
        });

        const outputFile = path.resolve(
            this.config.configFile ? path.dirname(this.config.configFile) : this.config.rootDir,
            this.options.outputFile ?? 'defect-candidates/latest.json',
        );
        try {
            fs.mkdirSync(path.dirname(outputFile), { recursive: true });
            fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
        } catch (error) {
            console.warn(`⚠️ Could not write ${outputFile}: ${(error as Error).message}`);
            return;
        }
        if (this.options.print !== false && (report.candidates.length > 0 || !report.run.complete)) {
            printSummary(report, outputFile);
        }
    }

    printsToStdio(): boolean {
        return false;
    }
}

function toAttempt(result: TestResult): AttemptRecord {
    const checked = result.annotations.filter((a) => a.type === CONTRACT_CHECKED).map((a) => a.description ?? '');
    return {
        retry: result.retry,
        status: result.status,
        checked,
        passed: result.annotations.filter((a) => a.type === CONTRACT_PASSED).map((a) => a.description ?? ''),
        violation: readViolation(result),
        error: result.error ? firstLine(result.error.message ?? result.error.value ?? '') : null,
    };
}

function readViolation(result: TestResult): ContractViolationRecord | null {
    const attachment = [...result.attachments].reverse().find((a) => a.name === VIOLATION_ATTACHMENT && a.body);
    if (!attachment?.body) return null;
    try {
        return JSON.parse(attachment.body.toString('utf8')) as ContractViolationRecord;
    } catch {
        return null;
    }
}

/** One outcome for all the repeat-each copies of a test: the worst one wins. */
function combineOutcomes(outcomes: Array<TestRecord['outcome']>): TestRecord['outcome'] {
    for (const outcome of ['unexpected', 'flaky', 'expected'] as const) {
        if (outcomes.includes(outcome)) return outcome;
    }
    return 'skipped';
}

function firstLine(text: string): string {
    return stripAnsi(text).trim().split('\n')[0].slice(0, 300);
}

function printSummary(report: DefectCandidateReport, outputFile: string): void {
    console.log(`\n🔎 ${report.summary}`);
    for (const candidate of report.candidates) {
        console.log(`   • ${candidate.contract} — ${candidate.reproduction} (${candidate.occurrences.map((o) => o.test).join('; ')})`);
    }
    console.log(`   Details: ${path.relative(process.cwd(), outputFile)}\n`);
}
