import { test, expect } from '../lib/page-object-fixtures';
import { isAutomationName, isOldEnoughToPurge, type TestDataKind } from '../domain/test-data/automation-data';
import { XenvioApi, type XenvioRecord } from '../infrastructure/xenvio-api';
import { TestDataRegistry } from '../runtime/test-data-registry';

/**
 * Maintenance — purge the test data left in QA (not a regression test).
 *
 * Every test deletes what it creates (testData fixture), but a run killed half-way, or a delete
 * the API rejected, can leave records behind. This lists the carriers, apps and best rates of
 * the configured warehouse whose names only the tests generate (domain/test-data/automation-data.ts)
 * and that are older than PURGE_MIN_AGE_HOURS (default 24): anything newer may belong to a run
 * that is still going, here or in CI.
 *
 *   npm run purge:test-data                                       → only LISTS them (dry run)
 *   PURGE_TEST_DATA=confirm npm run purge:test-data               → deletes them
 *   PURGE_MIN_AGE_HOURS=0 ...                                      → also today's (nothing else running)
 */
test('Purge test data left in QA', { tag: '@maintenance' }, async ({ xenvio, context }) => {
    const { config } = xenvio;
    const minAgeHours = Number(process.env.PURGE_MIN_AGE_HOURS ?? 24);
    expect(Number.isFinite(minAgeHours) && minAgeHours >= 0, 'PURGE_MIN_AGE_HOURS must be a number of hours').toBe(true);
    await xenvio.openSession(); // the API calls use this session's cookies

    const api = new XenvioApi(context.request, config.url);
    const warehouseId = await api.findWarehouseId(config.warehouse);
    const automation = (kind: TestDataKind) => (records: XenvioRecord[]) => records
        .filter((record) => isAutomationName(kind, record.name, config.warehouse))
        .map((record) => ({ kind, ...record }));

    const found = [
        ...automation('carrierAccount')(await api.listCarrierAccounts(warehouseId)),
        ...automation('app')(await api.listApps()),
        ...automation('bestRate')(await api.listBestRates(warehouseId)),
    ];
    const now = new Date();
    const leftovers = found.filter(({ name }) => isOldEnoughToPurge(name, now, minAgeHours));

    console.log(`\n🧹 Test data left in ${config.warehouse}: ${leftovers.length}`
        + ` (skipped ${found.length - leftovers.length} newer than ${minAgeHours}h)`);
    leftovers.forEach(({ kind, id, name }) => console.log(`   ${kind.padEnd(14)} #${String(id).padEnd(6)} ${name}`));

    if (process.env.PURGE_TEST_DATA !== 'confirm') {
        console.log('\nDry run — nothing deleted. Run with PURGE_TEST_DATA=confirm to delete them.\n');
        return;
    }

    const registry = new TestDataRegistry(api, false);
    leftovers.forEach(({ kind, id, name }) => registry.track(kind, id, name));
    expect(await registry.cleanup(), 'records that could not be deleted').toEqual([]);
});
