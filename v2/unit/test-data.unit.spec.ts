import { test, expect } from '@playwright/test';
import { TestDataRegistry, type TestDataApi } from '../runtime/test-data-registry';
import { automationStamp, isAutomationName, isOldEnoughToPurge } from '../domain/test-data/automation-data';
import { XenvioCarrierConfigPage } from '../page-objects/xenvio-carrier-config-page';
import { XenvioCreateAppPage } from '../page-objects/xenvio-create-app-page';
import { XenvioBestRatePage } from '../page-objects/xenvio-best-rate-page';

/** Records every delete; ids listed in `failingIds` answer like a rejected API call. */
function fakeApi(failingIds: number[] = []) {
    const deleted: string[] = [];
    const remove = (endpoint: string) => async (id: number) => {
        if (failingIds.includes(id)) throw new Error(`HTTP 401 on ${endpoint}/${id}`);
        deleted.push(`${endpoint}/${id}`);
    };
    const api: TestDataApi = {
        deleteCarrierAccount: remove('/carrier_accounts'),
        deleteApp: remove('/apps'),
        deleteBestRate: remove('/best_rates'),
    };
    return { api, deleted };
}

test.describe('Test data cleanup', { tag: ['@unit', '@test-data'] }, () => {

    test('deletes every tracked record with its own endpoint, newest first', async () => {
        const { api, deleted } = fakeApi();
        const registry = new TestDataRegistry(api, false);
        registry.track('carrierAccount', 1, 'USPS Carrier');
        registry.track('app', 2, 'qa20-app-10h00');
        registry.track('bestRate', 3, 'Best Rate Auto');

        expect(await registry.cleanup()).toEqual([]);
        expect(deleted).toEqual(['/best_rates/3', '/apps/2', '/carrier_accounts/1']);
    });

    test('a failed delete does not stop the rest and is reported', async () => {
        const { api, deleted } = fakeApi([2]);
        const registry = new TestDataRegistry(api, false);
        registry.track('carrierAccount', 1, 'USPS Carrier');
        registry.track('app', 2, 'qa20-app-10h00');

        expect(await registry.cleanup()).toEqual(['app "qa20-app-10h00" (#2)']);
        expect(deleted).toEqual(['/carrier_accounts/1']);
    });

    test('KEEP_TEST_DATA keeps everything', async () => {
        const { api, deleted } = fakeApi();
        const registry = new TestDataRegistry(api, true);
        registry.track('carrierAccount', 1, 'USPS Carrier');

        expect(await registry.cleanup()).toEqual([]);
        expect(deleted).toEqual([]);
    });

    test('a record is deleted only once even if cleanup runs twice', async () => {
        const { api, deleted } = fakeApi();
        const registry = new TestDataRegistry(api, false);
        registry.track('bestRate', 3, 'Best Rate Auto');

        await registry.cleanup();
        await registry.cleanup();
        expect(deleted).toEqual(['/best_rates/3']);
    });
});

test.describe('Automation data names (purge)', { tag: ['@unit', '@test-data'] }, () => {

    test('recognizes every name the generators produce', () => {
        expect(isAutomationName('carrierAccount', XenvioCarrierConfigPage.generateCarrierName('USPS'), 'qa20')).toBe(true);
        expect(isAutomationName('carrierAccount', 'Fedex OAuth Sandbox Auto 2026-09-01_10h05', 'qa20')).toBe(true);
        // Names left by older runs are still recognized
        expect(isAutomationName('carrierAccount', 'USPS Carrier 2026-10-12_14h53', 'qa20')).toBe(true);
        expect(isAutomationName('app', 'qa20-app-15h35', 'qa20')).toBe(true);
        expect(isAutomationName('app', XenvioCreateAppPage.generateAppName('qa20'), 'qa20')).toBe(true);
        expect(isAutomationName('bestRate', XenvioBestRatePage.generateBestRateName('Best Rate Auto', 0), 'qa20')).toBe(true);
        expect(isAutomationName('bestRate', XenvioBestRatePage.generateBestRateName(), 'qa20')).toBe(true);
    });

    test('never matches data created by people', () => {
        for (const name of ['RatesUSPS', 'PowershipQA', 'ProductionCarrier_EZ_USPS', 'USPS Carrier']) {
            expect(isAutomationName('carrierAccount', name, 'qa20'), name).toBe(false);
        }
        for (const name of ['multipleWH-app04-update', 'app-creadoWarehouseManager', 'qa20-app']) {
            expect(isAutomationName('app', name, 'qa20'), name).toBe(false);
        }
        for (const name of ['BestRate prueba', 'BRP', 'Best Rate Auto']) {
            expect(isAutomationName('bestRate', name, 'qa20'), name).toBe(false);
        }
    });

    test('apps only match the configured warehouse', () => {
        expect(isAutomationName('app', 'qa22-app-10h30', 'qa20')).toBe(false);
        expect(isAutomationName('app', 'qa22-app-10h30', 'qa22')).toBe(true);
    });

    test('the stamp is the local date-time to the second plus a 4-character random suffix', () => {
        const now = new Date(2026, 9, 19, 7, 23, 15);
        expect(automationStamp(now, () => 0.123456789)).toBe('20261019-072315-4fzz');
        expect(automationStamp(now, () => 0.5)).toBe('20261019-072315-i000'); // short draws are padded
    });

    test('two names in the same second differ when the random draw differs (parallel workers)', () => {
        const now = new Date(2026, 9, 19, 7, 23, 15);
        expect(automationStamp(now, () => 0.111)).not.toBe(automationStamp(now, () => 0.222));
    });
});

test.describe('Purge age (never touch a run that may still be going)', { tag: ['@unit', '@test-data'] }, () => {
    const now = new Date(2026, 9, 19, 12, 0, 0);

    test('a record newer than the margin is kept', () => {
        expect(isOldEnoughToPurge('USPS Carrier 20261019-090000-k3f9', now, 24)).toBe(false);
        expect(isOldEnoughToPurge('Best Rate Auto 2026-10-19_11h59m00s_W0', now, 24)).toBe(false);
    });

    test('a record older than the margin can be purged, whatever the name format', () => {
        expect(isOldEnoughToPurge('USPS Carrier 20261017-090000-k3f9', now, 24)).toBe(true);
        expect(isOldEnoughToPurge('USPS Carrier 2026-10-12_14h53', now, 24)).toBe(true);
        expect(isOldEnoughToPurge('Best Rate Auto 2026-09-21_15h34m51s_W1', now, 24)).toBe(true);
    });

    test('PURGE_MIN_AGE_HOURS=0 allows today\'s records', () => {
        expect(isOldEnoughToPurge('USPS Carrier 20261019-115900-k3f9', now, 0)).toBe(true);
    });

    test('names without a date (apps from older runs) count as old', () => {
        expect(isOldEnoughToPurge('qa20-app-15h35', now, 24)).toBe(true);
    });
});
