# Test data cleanup

Tests that create configuration in QA (carriers, apps, best rates) delete it when they end,
passed or failed. Leftover carriers are not harmless: Xenvio asks every carrier of the
warehouse for rates, so a test carrier with bad credentials breaks GET RATES for other tests.

## In a test

Request the `testData` fixture and register what the test creates. The save methods call
`onCreated` with the id from the backend's creation response as soon as it arrives, before
waiting for the UI, so the record is cleaned up even if that wait fails:

```ts
test('...', async ({ xenvio, testData }) => {
    await carrierConfigPage.clickSave((id) => testData.track('carrierAccount', id, carrierName));
});
```

| Kind | Created by | Deleted with |
|---|---|---|
| `carrierAccount` | `XenvioCarrierConfigPage.clickSave()` | `DELETE /carrier_accounts/:id` (hard delete, with its shipping codes) |
| `app` | `XenvioCreateAppPage.clickCreateApp()` | `DELETE /apps/:id` (soft delete, admin user) |
| `bestRate` | `XenvioBestRatePage.clickSaveAndContinue()` | `DELETE /best_rates/:id` (soft delete) |

- Records are deleted by id, so data created by people is never touched.
- The calls use the browser session cookies (`context.request`); no API token is needed.
- A failed delete does not fail the test: it is logged and added as a
  "Test data not deleted" annotation.
- `KEEP_TEST_DATA=1` keeps everything, e.g. to inspect a failure in the UI.

Code: `runtime/test-data-registry.ts`, `infrastructure/xenvio-api.ts`.

## Purge what was left behind

A run killed half-way skips the cleanup. The purge finds the records whose names only the
generators produce (`domain/test-data/automation-data.ts`) in the configured warehouse, and
only those **older than 24 hours**: a newer one may belong to a run that is still going (here
or in CI). Names are unique (`USPS Carrier 20261019-072315-k3f9`): date, time to the second
and a random suffix, so parallel workers never share one.

```bash
npm run purge:test-data                                  # lists them, deletes nothing
PURGE_TEST_DATA=confirm npm run purge:test-data          # deletes them
PURGE_MIN_AGE_HOURS=0 PURGE_TEST_DATA=confirm npm run purge:test-data   # also today's (nothing else running)
```

When you add a new name generator, add its pattern to `automation-data.ts`; the unit tests
in `v2/unit/test-data.unit.spec.ts` check that both stay in sync.
