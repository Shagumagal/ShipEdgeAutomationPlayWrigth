# Test data cleanup

Tests that create configuration in QA (carriers, apps, best rates) delete it when they end,
passed or failed. Leftover carriers are not harmless: Xenvio asks every carrier of the
warehouse for rates, so a test carrier with bad credentials breaks GET RATES for other tests.

## In a test

Request the `testData` fixture and register what the test creates. The page objects return
the id from the backend's creation response:

```ts
test('...', async ({ xenvio, testData }) => {
    const carrierAccountId = await carrierConfigPage.clickSave();
    testData.track('carrierAccount', carrierAccountId, carrierName);
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
generators produce (`domain/test-data/automation-data.ts`) in the configured warehouse:

```bash
npm run purge:test-data                           # lists them, deletes nothing
PURGE_TEST_DATA=confirm npm run purge:test-data   # deletes them
```

When you add a new name generator, add its pattern to `automation-data.ts`; the unit tests
in `v2/unit/test-data.unit.spec.ts` check that both stay in sync.
