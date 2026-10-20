import { test, type TestInfo } from '@playwright/test';
import { PRODUCT_CONTRACTS, ProductOutcomeError, type ContractId } from '../domain/contracts/product-contracts';
import type { ContractViolationRecord } from '../domain/contracts/defect-candidates';
import { redactSensitive } from './carrier-failure-report';
import { CONTRACT_CHECKED, CONTRACT_PASSED, CONTRACT_VIOLATED, PRODUCT_DEFECT_TAG, stripAnsi, VIOLATION_ATTACHMENT } from './product-defect-marks';

const MAX_MESSAGE_CHARS = 2000;

/** Where the marks go: the current attempt (a fake in unit tests, so they never add candidates). */
export type ContractRecorder = Pick<TestInfo, 'annotations' | 'attach'>;

/**
 * Runs one product contract check (domain/contracts/product-contracts.ts) and returns what the
 * check returns. The attempt is marked as having reached the contract; if the check fails with an
 * assertion (expect) or a ProductOutcomeError, the attempt is marked as violating it, the evidence
 * is attached (redacted) and the error is prefixed with [PRODUCT DEFECT CANDIDATE] <id>.
 *
 * Any other error (a selector that never shows, a 5xx, a provider outage) is rethrown untouched:
 * the test fails as usual, but that alone is not a candidate.
 *
 *   await contract('invitation.link.sso-path-normalized',
 *       () => expect(link.pathNormalized).toBe(true),
 *       { link: link.url });
 */
export async function contract<T>(
    id: ContractId,
    check: () => T | Promise<T>,
    evidence?: unknown,
    info: ContractRecorder = test.info(),
): Promise<T> {
    info.annotations.push({ type: CONTRACT_CHECKED, description: id });

    try {
        const value = await check();
        info.annotations.push({ type: CONTRACT_PASSED, description: id });
        return value;
    } catch (error) {
        if (!(error instanceof Error) || !isContractViolation(error)) throw error;

        const violation: ContractViolationRecord = {
            id,
            message: (redactEvidence(stripAnsi(error.message)) as string).slice(0, MAX_MESSAGE_CHARS),
            evidence: redactEvidence(evidence),
        };
        info.annotations.push({ type: CONTRACT_VIOLATED, description: id });
        await info.attach(VIOLATION_ATTACHMENT, {
            body: JSON.stringify(violation, null, 2),
            contentType: 'application/json',
        }).catch(() => undefined); // evidence must never change the result

        tagError(error, `${PRODUCT_DEFECT_TAG} ${id}: ${PRODUCT_CONTRACTS[id].requirement}`);
        throw error;
    }
}

/** A failed expect or product outcome. Poll timeouts are plain Errors, including with a custom message. */
export function isContractViolation(error: Error): boolean {
    const message = stripAnsi(error.message).trimStart();
    return error instanceof ProductOutcomeError
        || 'matcherResult' in error
        || /^(Error: )?expect(\.poll|\.soft)?\(/.test(message)
        // A custom message precedes the matcher output. Require the polling timeout as well,
        // so a plain exception from the API callback remains an infrastructure failure.
        || (/^expect(\.poll|\.soft)?\(/m.test(message)
            && /\nCall Log:\n- Timeout \d+ms exceeded while waiting on the predicate/.test(message));
}

/** Credentials and one-time tokens never reach the report; the rest of the evidence is kept. */
export function redactEvidence(evidence: unknown): unknown {
    const masked = redactSensitive(evidence);
    const maskTokens = (text: string) => text.replace(/([?&](?:[\w-]*token|code|state|session_state)=)([^&#"'\s]+)/gi, '$1[REDACTED]');
    return JSON.parse(JSON.stringify(masked ?? null, (_key, value) => (typeof value === 'string' ? maskTokens(value) : value)));
}

function tagError(error: Error, prefix: string): void {
    const original = error.message;
    error.message = `${prefix}\n${redactEvidence(original) as string}`;
    if (error.stack) {
        error.stack = redactEvidence(error.stack.replace(original, error.message)) as string;
    }
}
