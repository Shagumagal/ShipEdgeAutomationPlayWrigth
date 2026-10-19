import { test, expect } from '@playwright/test';
import config from '../../playwright.config';
import { summarizeCarrierErrors } from '../domain/carriers/carrier-errors';
import {
    CARRIER_FAILURE_TAG,
    buildCarrierFailureReason,
    redactSensitive,
} from '../diagnostics/carrier-failure-report';
import { VOID_USPS_TRANSIENT_ERROR, easyPost401, rateShoppingNoise } from './fixtures/carrier-samples';

test.describe('Carrier failure report', { tag: ['@unit', '@carriers'] }, () => {

    test('classifies as external when the carrier rejected the task', () => {
        const reason = buildCarrierFailureReason({
            taskErrors: [{ task: 'void_label', status: 400, error: VOID_USPS_TRANSIENT_ERROR }],
            carrierErrors: [],
            noRatesVisible: false,
        });
        expect(reason).toBe(`${CARRIER_FAILURE_TAG} Task "void_label" was rejected by the carrier: the USPS API did not return a valid response`);
    });

    test('classifies "no rates" only when carriers also failed', () => {
        const carrierErrors = summarizeCarrierErrors([easyPost401, rateShoppingNoise]);
        const reason = buildCarrierFailureReason({ taskErrors: [], carrierErrors, noRatesVisible: true });
        expect(reason).toContain(`${CARRIER_FAILURE_TAG} No rates available`);
        expect(reason).toContain('EasyPost 401 UNAUTHORIZED');
        expect(reason).toContain('dragon.iot-easy.cn 500');

        expect(buildCarrierFailureReason({ taskErrors: [], carrierErrors: [], noRatesVisible: true })).toBeNull();
    });

    test('does NOT classify rate-shopping noise or Xenvio-own errors as external', () => {
        // A selector failing after asking for rates: the log has errors, but the carrier rejected nothing.
        expect(buildCarrierFailureReason({
            taskErrors: [],
            carrierErrors: summarizeCarrierErrors([rateShoppingNoise]),
            noRatesVisible: false,
        })).toBeNull();
        expect(buildCarrierFailureReason({
            taskErrors: [{ task: 'label', status: 400, error: 'only actual owner can manage this shipment' }],
            carrierErrors: [],
            noRatesVisible: false,
        })).toBeNull();
    });

    test('masks credentials travelling in the URL query string and in task errors', () => {
        const redacted = JSON.stringify(redactSensitive({
            url: 'https://api.carrier.com/v1/labels?account=123&api_key=SECRET-KEY&signature=abc123',
            taskError: 'carrier response error: call to https://ws.carrier.com/rate?token=LEAKED-TOKEN failed',
        }));

        expect(redacted).not.toContain('SECRET-KEY');
        expect(redacted).not.toContain('abc123');
        expect(redacted).not.toContain('LEAKED-TOKEN');
        expect(redacted).toContain('api_key=[REDACTED]');
        expect(redacted).toContain('account=123');
    });

    test('masks credentials in headers, Ruby hashes, JSON and XML', () => {
        const redacted = JSON.stringify(redactSensitive({
            request_header: '{"Authorization"=>"Basic Og==", "Content-Type"=>"application/json"}',
            headers: { Authorization: 'Bearer real-token', 'x-api-key': 'k-123' },
            body: { client_id: 'abc', client_secret: 'shh', account_number: '123456', weight: 80 },
            xml: '<v1:Key>ABC</v1:Key><v1:Password>pwd</v1:Password><Weight>5</Weight>',
        }));

        for (const secret of ['real-token', 'k-123', 'shh', '123456', '>ABC<', '>pwd<', '"abc"']) {
            expect(redacted).not.toContain(secret);
        }
        expect(redacted).toContain('[REDACTED] (empty credentials)');
        expect(redacted).toContain('application/json');
        expect(redacted).toContain('"weight":80');
        expect(redacted).toContain('<Weight>5</Weight>');
    });
});

test.describe('Allure categories', { tag: ['@unit', '@reporting'] }, () => {
    type Category = { name: string; messageRegex?: string };

    function categories(): Category[] {
        const reporters = (config.reporter ?? []) as Array<[string, { categories?: Category[] }]>;
        return reporters.find(([name]) => name === 'allure-playwright')?.[1].categories ?? [];
    }

    /** Allure (Java) uses Pattern.matches → full match; emulate `(?s)` with the "s" flag. */
    function matchingCategories(message: string): string[] {
        return categories()
            .filter((category) => category.messageRegex)
            .filter((category) => new RegExp(`^(?:${category.messageRegex!.replace('(?s)', '')})$`, 's').test(message))
            .map((category) => category.name);
    }

    test('an [EXTERNAL CARRIER] failure lands only in its own category, even with 401 or timeout in the message', () => {
        const message = `${CARRIER_FAILURE_TAG} Sin rates disponibles; EasyPost 401 UNAUTHORIZED\n\nTimeoutError: locator.waitFor: Timeout 30000ms exceeded.\n  - waiting for locator('mat-dialog-content div.cursor-pointer')`;
        expect(matchingCategories(message)).toEqual(['External carrier error']);
    });

    test('untagged failures are still classified as before', () => {
        expect(matchingCategories('Error: 401 Unauthorized')).toEqual(['Authentication / session']);
        expect(matchingCategories('TimeoutError: waiting for locator(\'#x\')')).toEqual(['Stale selector / element not found']);
        expect(matchingCategories('expect(received).toBe(expected)\nExpected: 1\nReceived: 2')).toEqual(['Functional defect (assertion)']);
    });
});
