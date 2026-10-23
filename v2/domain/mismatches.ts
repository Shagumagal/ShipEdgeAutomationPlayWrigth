/**
 * Shared wording of the domain mismatch checks: each difference is one readable line,
 * "<field> is <actual>, expected <expected>", so every contract reports the same way. Pure module.
 */

/** One line per row whose actual value is not exactly (===) the expected one. */
export function differences(rows: Array<[field: string, actual: unknown, expected: unknown]>): string[] {
    return rows
        .filter(([, actual, expected]) => actual !== expected)
        .map(([field, actual, expected]) => `${field} is ${json(actual)}, expected ${typeof expected === 'string' ? `"${expected}"` : json(expected)}`);
}

/** Comparison key that ignores case and surrounding blanks; a missing value equals an empty one. */
export function comparable(value: unknown): string {
    return value == null ? '' : String(value).trim().toLocaleUpperCase();
}

export function roundCents(value: number): number {
    return Math.round(value * 100) / 100;
}

export function json(value: unknown): string {
    return JSON.stringify(value ?? null);
}
