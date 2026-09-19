# Test Tagging (v2 suite)

The `v2/tests` suite is tagged along **two independent dimensions**, both using
Playwright's native tag syntax (`test.describe(title, { tag: [...] }, ...)`), not
just Allure metadata. That distinction matters: native tags are what `--grep`
actually filters on when Playwright decides which tests to run. Allure `tags:`
metadata (set via `AllureHelper.applyTestMetadata`) is kept in sync with the same
words so the Allure report groups tests the same way, but Allure metadata alone
never controls execution — only the native `{ tag: [...] }` does.

## Dimension 1 — Tier

Answers "how much of the system does this test exercise, and how often should it
run?"

| Tag        | Meaning                                                                 | Count |
|------------|--------------------------------------------------------------------------|:-----:|
| `@smoke`   | Fastest, narrowest check that the app is alive (login, basic navigation) |   3   |
| `@sanity`  | One feature, one happy path, no multi-step business flow                 |   4   |
| `@e2e`     | Multi-step business flow, cross-feature, or cross-system                 |  19   |

A test carries **exactly one** tier tag.

## Dimension 2 — Feature

Answers "what business capability does this test actually verify?" — named after
the same services `v2/services/` already uses (`OrderService`, `RatesService`,
`LabelService`, `CarrierService`, `PackageService`, `ShipmentConfigurationService`),
so the tag vocabulary and the code vocabulary stay the same.

| Tag                 | Service it maps to             | Count |
|----------------------|--------------------------------|:-----:|
| `@orders`            | OrderService                   |   8   |
| `@labels`             | LabelService                   |   7   |
| `@carriers`           | CarrierService                 |   3   |
| `@rates`              | RatesService                   |   2   |
| `@packages`           | PackageService (Packing Station)|   1   |
| `@shipment-config`    | ShipmentConfigurationService   |   1   |
| `@apps`               | Create App / webhook flow      |   1   |
| `@session`            | Login + Shipper View load      |   1   |
| `@shortcuts`          | Keyboard Shortcuts modal       |   1   |

A test can carry **one or more** feature tags when its flow genuinely spans
capabilities (e.g. "order to label" verifies both order creation and label
generation, so it carries `@orders` and `@labels`).

**Tagging rule**: a feature tag is assigned based on what the test's
*assertions* verify, not every intermediate setup step. Most `v2` tests create
an order as step 1 before testing something else — that alone does not earn a
test the `@orders` tag unless order creation itself is what's being verified.

## Full mapping (v2/tests)

| File                                                     | Tier      | Features                    |
|-----------------------------------------------------------|-----------|------------------------------|
| xenvio-order-get-rates.spec.ts                             | `@smoke`  | `@rates`                     |
| xenvio-shipper-view.spec.ts                                 | `@smoke`  | `@session`                   |
| xenvio-shortcuts.spec.ts                                    | `@smoke`  | `@shortcuts`                 |
| xenvio-new-order.spec.ts                                    | `@sanity` | `@orders`                    |
| xenvio-order-to-label.spec.ts                               | `@sanity` | `@orders` `@labels`          |
| xenvio-void-label.spec.ts                                   | `@sanity` | `@labels`                    |
| xenvio-carrier-configuration.spec.ts                        | `@sanity` | `@carriers`                  |
| xenvio-new-order-multibox.spec.ts                           | `@e2e`    | `@orders`                    |
| xenvio-multibox-carrier-restriction.spec.ts                 | `@e2e`    | `@carriers`                  |
| xenvio-packing-station-monobox.spec.ts                      | `@e2e`    | `@packages`                  |
| xenvio-shipper-view-order-international-multibox.spec.ts    | `@e2e`    | `@orders` `@labels`          |
| xenvio-shipper-view-order-international.spec.ts             | `@e2e`    | `@orders` `@labels`          |
| xenvio-order-to-label-multibox.spec.ts                      | `@e2e`    | `@orders` `@labels`          |
| xenvio-order-to-label-batch.spec.ts                         | `@e2e`    | `@orders` `@labels`          |
| xenvio-shipper-view-create-app.spec.ts                      | `@e2e`    | `@apps`                      |
| xenvio-carrier-data-driven.spec.ts (8 parametrized tests)   | `@e2e`    | `@carriers`                  |
| xenvio-shipper-new-best-rate.spec.ts                        | `@e2e`    | `@rates`                     |
| xenvio-core-import-verify.spec.ts                           | `@e2e`    | `@orders`                    |
| xenvio-include-return-label.spec.ts                         | `@e2e`    | `@labels` `@shipment-config` |

26 tests total across 19 files (3 smoke + 4 sanity + 19 e2e).

## How to run

### npm scripts (tier only)

```bash
npm run test:smoke-v2      # --grep @smoke
npm run test:sanity-v2     # --grep @sanity
npm run test:e2e-v2        # --grep @e2e
npm run test:regression-v2 # no grep, full v2 suite
```

### Raw Playwright CLI (tier, feature, or both)

Filter by feature only, any tier:

```bash
npx playwright test --project=xenvio-v2 --grep "@carriers"
```

Filter by tier only:

```bash
npx playwright test --project=xenvio-v2 --grep "@e2e"
```

Combine both dimensions — **use a lookahead regex**, not `"@e2e.*@carriers"`.
A plain concatenated pattern only matches if the tags happen to appear in that
exact order in the generated title, which is fragile. The lookahead form matches
regardless of tag order and is what should be used going forward:

```bash
npx playwright test --project=xenvio-v2 --grep "(?=.*@e2e)(?=.*@carriers)"
```

Exclude a feature or tier with `--grep-invert`:

```bash
# everything except international scenarios
npx playwright test --project=xenvio-v2 --grep-invert "international"
```

List without running, to sanity-check a filter before spending CI minutes on it:

```bash
npx playwright test --project=xenvio-v2 --grep "@labels" --list
```

## Worked example: "I only care about labels right now"

Say a change touched `LabelService` or `xenvio-order-to-label-page.ts`, and the
question is "what should I run to get confidence on labels without running the
full 26-test suite?"

```bash
npx playwright test --project=xenvio-v2 --grep "@labels"
```

This resolves to 7 tests, across 7 files: `xenvio-order-to-label`,
`xenvio-void-label`, `xenvio-order-to-label-multibox`,
`xenvio-order-to-label-batch`, `xenvio-shipper-view-order-international`,
`xenvio-shipper-view-order-international-multibox`, and
`xenvio-include-return-label`. That set already spans domestic, multibox,
batch, international and return-label variants of label generation — a much
tighter, faster loop than the full regression while still covering every shape
of the feature.

If there's time pressure and only the fast confidence check matters:

```bash
npx playwright test --project=xenvio-v2 --grep "(?=.*@sanity)(?=.*@labels)"
```

This narrows to just `xenvio-void-label` and `xenvio-order-to-label` — the two
non-multibox, non-international label tests — for a quick pre-commit check,
reserving the full `@labels` set (multibox/batch/international) for CI.

## Worked example: "I only care about orders right now"

Same question, but the change touched `OrderService` or order creation UI:

```bash
npx playwright test --project=xenvio-v2 --grep "@orders"
```

This resolves to 8 tests across 8 files. Notice it does **not** include
`xenvio-shortcuts.spec.ts`, even though that test creates an order as its first
step — it isn't tagged `@orders` because what it actually verifies is the
Keyboard Shortcuts modal, not order creation. That is the tagging rule in
practice: order creation there is scaffolding, not the thing under test, so it
doesn't pollute the `@orders` result set with a test that tells you nothing new
about orders if it fails.

To check only the riskiest order scenarios (multi-step, cross-system) before a
release:

```bash
npx playwright test --project=xenvio-v2 --grep "(?=.*@e2e)(?=.*@orders)"
```

This gives 6 of those 8 — it excludes the two `@sanity`-tagged order tests
(`xenvio-new-order.spec.ts` and `xenvio-order-to-label.spec.ts`) and keeps the
multibox, international, batch and cross-system (`core-import-verify`) order
scenarios.

## Adding a tag to a new test

1. Pick exactly one tier: `@smoke`, `@sanity`, or `@e2e`.
2. Pick one or more features from the table above, or propose a new one if the
   test genuinely covers a capability not yet listed (keep it aligned with a
   `v2/services/` name where one exists).
3. Set both on the `test.describe(...)` call — it tags every test inside that
   describe block, so a file with a loop generating many test cases (like
   `xenvio-carrier-data-driven.spec.ts`) only needs the tag once:

   ```typescript
   test.describe('Xenvio <Feature> (v2 PrimeNG)', { tag: ['@e2e', '@labels'] }, () => {
       // ...
   });
   ```

4. Mirror the same words in the Allure `tags:` array inside
   `AllureHelper.applyTestMetadata(...)` so the Allure report groups the test
   the same way the CLI filters it.
