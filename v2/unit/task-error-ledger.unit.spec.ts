import { test, expect } from '@playwright/test';
import { TaskErrorLedger } from '../diagnostics/task-error-ledger';
import { buildCarrierFailureReason } from '../diagnostics/carrier-failure-report';
import { VOID_USPS_TRANSIENT_ERROR } from './fixtures/carrier-samples';

const labelError = { task: 'label', status: 400, error: 'carrier response error: 503 Service Unavailable' };
const voidError = { task: 'void_label', status: 400, error: VOID_USPS_TRANSIENT_ERROR };

test.describe('Task error ledger (carrier failure classification)', { tag: ['@unit', '@carriers'] }, () => {

    test('a retry that succeeds on the same shipment resolves the error', () => {
        const ledger = new TaskErrorLedger();
        ledger.recordError('101', voidError, 0);
        ledger.recordSuccess('101', 'void_label', 1);

        // The retry got past the carrier error, then a UI assertion failed: not a carrier failure.
        expect(ledger.unresolved).toEqual([]);
        expect(buildCarrierFailureReason({ taskErrors: ledger.unresolved, carrierErrors: [], noRatesVisible: false })).toBeNull();
    });

    test('a success on another shipment resolves nothing (batch: order 2 must not hide order 1)', () => {
        const ledger = new TaskErrorLedger();
        ledger.recordError('101', labelError, 0);
        ledger.recordSuccess('202', 'label', 1);

        expect(ledger.unresolved).toEqual([labelError]);
    });

    test('a success of another task on the same shipment resolves nothing', () => {
        const ledger = new TaskErrorLedger();
        ledger.recordError('101', voidError, 0);
        ledger.recordSuccess('101', 'label', 1);

        expect(ledger.unresolved).toEqual([voidError]);
    });

    test('an old error whose body is parsed after the later success stays resolved', () => {
        const ledger = new TaskErrorLedger();
        // Arrival: error (seq 0) then success (seq 1); the success is processed first.
        ledger.recordSuccess('101', 'label', 1);
        ledger.recordError('101', labelError, 0);

        expect(ledger.unresolved).toEqual([]);
    });

    test('a new failure after a success counts again', () => {
        const ledger = new TaskErrorLedger();
        ledger.recordError('101', labelError, 0);
        ledger.recordSuccess('101', 'label', 1);
        ledger.recordError('101', labelError, 2);

        expect(ledger.unresolved).toEqual([labelError]);
    });

    test('unresolved errors keep their arrival order across shipments', () => {
        const ledger = new TaskErrorLedger();
        ledger.recordError('202', voidError, 3);
        ledger.recordError('101', labelError, 1);

        expect(ledger.unresolved).toEqual([labelError, voidError]);
    });
});
