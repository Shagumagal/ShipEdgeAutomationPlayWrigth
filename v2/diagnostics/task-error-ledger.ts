import type { XenvioTaskError } from '../domain/carriers/carrier-errors';

/**
 * Which task_executor errors are still unresolved — pure logic, no Playwright.
 *
 * An error is resolved only by a later success of the SAME task on the SAME shipment (e.g. the
 * label retry after a carrier 503). A success on another shipment (the next order of a batch)
 * resolves nothing. Each response carries its arrival order (`seq`, taken when Playwright reports
 * it, before its body is read): an error whose body is parsed after a later success of that
 * task is an old attempt and stays resolved.
 *
 * Covered by v2/unit/task-error-ledger.unit.spec.ts.
 */
export class TaskErrorLedger {
    private readonly errorsByKey = new Map<string, { seq: number; error: XenvioTaskError }[]>();
    private readonly lastSuccessByKey = new Map<string, number>();

    recordError(shipmentId: string, error: XenvioTaskError, seq: number): void {
        const key = keyOf(shipmentId, error.task);
        if ((this.lastSuccessByKey.get(key) ?? -1) > seq) return;
        this.errorsByKey.set(key, [...(this.errorsByKey.get(key) ?? []), { seq, error }]);
    }

    recordSuccess(shipmentId: string, task: string | null, seq: number): void {
        const key = keyOf(shipmentId, task);
        this.lastSuccessByKey.set(key, Math.max(seq, this.lastSuccessByKey.get(key) ?? -1));
        this.errorsByKey.set(key, (this.errorsByKey.get(key) ?? []).filter((entry) => entry.seq > seq));
    }

    /** Unresolved errors in arrival order. */
    get unresolved(): XenvioTaskError[] {
        return [...this.errorsByKey.values()]
            .flat()
            .sort((a, b) => a.seq - b.seq)
            .map(({ error }) => error);
    }
}

function keyOf(shipmentId: string, task: string | null): string {
    return `${shipmentId}|${task ?? ''}`;
}
