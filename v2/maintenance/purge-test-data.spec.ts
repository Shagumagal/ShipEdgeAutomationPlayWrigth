import { test, expect } from '../lib/page-object-fixtures';
import { isAutomationName, type TestDataKind } from '../domain/test-data/automation-data';
import { XenvioApi, type XenvioRecord } from '../infrastructure/xenvio-api';
import { TestDataRegistry } from '../runtime/test-data-registry';

/**
 * Maintenance — purge the test data left in QA (not a regression test).
 *
 * Every test deletes what it creates (testData fixture), but a run killed half-way, or a delete
 * the API rejected, can leave records behind. This lists the carriers, apps and best rates of
 * the configured warehouse whose names only the tests generate (domain/test-data/automation-data.ts).
 *
 *   npm run purge:test-data                            → only LISTS them (dry run)
 *   PURGE_TEST_DATA=confirm npm run purge:test-data    → deletes them
 */
test('Purge test data left in QA', { tag: '@maintenance' }, async ({ xenvio, context }) => {
    const { config } = xenvio;
    await xenvio.openSession(); // the API calls use this session's cookies

    const api = new XenvioApi(context.request, config.url);
    const warehouseId = await api.findWarehouseId(config.warehouse);
    const automation = (kind: TestDataKind) => (records: XenvioRecord[]) => records
        .filter((record) => isAutomationName(kind, record.name, config.warehouse))
        .map((record) => ({ kind, ...record }));

    const leftovers = [
        ...automation('carrierAccount')(await api.listCarrierAccounts(warehouseId)),
        ...automation('app')(await api.listApps()),
        ...automation('bestRate')(await api.listBestRates(warehouseId)),
    ];

    console.log(`\n🧹 Test data left in ${config.warehouse}: ${leftovers.length}`);
    leftovers.forEach(({ kind, id, name }) => console.log(`   ${kind.padEnd(14)} #${String(id).padEnd(6)} ${name}`));

    if (process.env.PURGE_TEST_DATA !== 'confirm') {
        console.log('\nDry run — nothing deleted. Run with PURGE_TEST_DATA=confirm to delete them.\n');
        return;
    }

    const registry = new TestDataRegistry(api, false);
    leftovers.forEach(({ kind, id, name }) => registry.track(kind, id, name));
    expect(await registry.cleanup(), 'records that could not be deleted').toEqual([]);
});
