import { test, expect } from '@playwright/test';
import {
    MAX_TRANSIENT_CARRIER_RETRIES,
    decideCarrierRetry,
    isTransientCarrierError,
} from '../domain/carriers/carrier-retry-policy';
import { shouldRetryReturnLabel } from '../parsers/return-label-parser';
import {
    EASYPOST_401_TASK_ERROR,
    LABEL_MISSING_RATE_ERROR,
    VOID_USPS_TRANSIENT_ERROR,
} from './fixtures/carrier-samples';

test.describe('Carrier error retry policy', { tag: ['@unit', '@carriers'] }, () => {

    test('retries transient carrier errors', () => {
        for (const transient of [
            VOID_USPS_TRANSIENT_ERROR,
            'Carrier error message: The label can\'t be generated, please try again.',
            'carrier response error: 503 Service Unavailable',
            'carrier response error: Net::ReadTimeout (timed out)',
            'FedEx: Too Many Requests (429)',
            'carrier response error: 502 Bad Gateway',
        ]) {
            expect(isTransientCarrierError(transient), transient).toBe(true);
        }
    });

    test('does NOT retry permanent errors: credentials, missing rate, address', () => {
        for (const permanent of [
            LABEL_MISSING_RATE_ERROR,
            EASYPOST_401_TASK_ERROR,
            'Carrier message: The label can\'t be generated, the shipping method requested has no rate.',
            'carrier response error: invalid_client',
            'carrier response error: Could not obtain access token',
            'carrier response error: Invalid address, please try again',
        ]) {
            expect(isTransientCarrierError(permanent), permanent).toBe(false);
        }
    });

    test('does NOT retry Xenvio errors even when they say "try again"', () => {
        expect(isTransientCarrierError('other user has request release the shipment, Please hold two minutes and try again')).toBe(false);
        expect(isTransientCarrierError('only actual owner can manage this shipment')).toBe(false);
        expect(isTransientCarrierError('Internal Server Error')).toBe(false);
    });

    test('does not retry an unknown or empty error', () => {
        expect(isTransientCarrierError('carrier response error: something unexpected happened')).toBe(false);
        expect(isTransientCarrierError(null)).toBe(false);
        expect(isTransientCarrierError('')).toBe(false);
    });

    test('accepts errors as objects (task_executor body)', () => {
        expect(isTransientCarrierError({ error: 'carrier response error: 503 Service Unavailable' })).toBe(true);
    });

    test('retries at most once', () => {
        expect(MAX_TRANSIENT_CARRIER_RETRIES).toBe(1);
        expect(decideCarrierRetry(VOID_USPS_TRANSIENT_ERROR, 0).retry).toBe(true);
        expect(decideCarrierRetry(VOID_USPS_TRANSIENT_ERROR, 1)).toEqual({
            retry: false,
            reason: 'transient carrier error, but 1 retry(ies) already done',
        });
        expect(decideCarrierRetry(LABEL_MISSING_RATE_ERROR, 0).retry).toBe(false);
    });

    test('return label: still retries on 1008, and now also on a transient error', () => {
        expect(shouldRetryReturnLabel(null, 'carrier response error: {"errors":[{"error_code":"1008"}]}')).toBe(true);
        expect(shouldRetryReturnLabel(null, 'carrier response error: 503 Service Unavailable')).toBe(true);
        // Con return label ya creado, o error permanente (800000), no se reintenta.
        expect(shouldRetryReturnLabel({ id: 1 }, 'carrier response error: 503 Service Unavailable')).toBe(false);
        expect(shouldRetryReturnLabel(null, 'carrier response error: {"errors":[{"error_code":"800000","error_message":"The is_return_label specified is invalid."}]}')).toBe(false);
    });
});
