import { test, expect } from '@playwright/test';
import { TestDataRegistry, type TestDataApi } from '../runtime/test-data-registry';
import { isAutomationName } from '../domain/test-data/automation-data';
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
});
