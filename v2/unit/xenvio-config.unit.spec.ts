import { test, expect } from '@playwright/test';
import { loadOrdersToCreate } from '../config/xenvio-config';

test.describe('ORDERS_TO_CREATE', { tag: ['@unit', '@config'] }, () => {

    test('uses the fallback when unset or blank', () => {
        expect(loadOrdersToCreate(3, {})).toBe(3);
        expect(loadOrdersToCreate(1, { ORDERS_TO_CREATE: '  ' })).toBe(1);
    });

    test('accepts a whole number of 1 or more', () => {
        expect(loadOrdersToCreate(3, { ORDERS_TO_CREATE: '5' })).toBe(5);
    });

    test('rejects values that would run no order and still pass', () => {
        for (const value of ['0', '-2', 'abc', '2.5']) {
            expect(() => loadOrdersToCreate(3, { ORDERS_TO_CREATE: value }), value)
                .toThrow(/ORDERS_TO_CREATE must be a whole number of 1 or more/);
        }
    });
});
