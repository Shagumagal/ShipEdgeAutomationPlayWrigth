# v1 retirement (28/09/2026)

The legacy v1 suite (AngularMaterial, Playwright project `msedge`) was **removed**. Xenvio
migrated its UI to Angular + PrimeNG, v2 covers the same business flows, and keeping both
suites meant every shared change had to be made twice.

## What was removed

| Removed | Replacement |
|---|---|
| `v1/tests`, `v1/page-objects` | `v2/tests`, `v2/page-objects` |
| Playwright project `msedge` | project `xenvio-v2` |
| npm script `test:v1` | `npm run test:v2` |
| `lib/` at the repository root (shared by v1 and v2) | see the table below |

The modules of the old root `lib/` that v2 was still using moved inside `v2/`, each one to
the folder that owns its responsibility:

| Before | Now |
|---|---|
| `lib/basepage.ts` | `v2/page-objects/base-page.ts` |
| `lib/logger.ts` | `v2/infrastructure/logger.ts` |
| `lib/allure-helper.ts` | `v2/evidence/allure-helper.ts` |
| `lib/test-failure-capture.ts` | `v2/diagnostics/test-failure-capture.ts` |
| `lib/test-data.ts` (types) | `v2/domain/orders/order-data.ts` |
| `lib/test-data.ts` (generators and fixtures) | `v2/test-data/generators.ts` (re-exported by `v2/test-data`) |
| `v1/page-objects/shipedge-login-page.ts`, `shipedge-orders-page.ts` | `v2/page-objects/core/` (used by the core-import flow) |

The rest of the old `lib/` (`xenvio-workflows.ts`, `page-object-fixtures.ts`,
`helpers-fixtures.ts`, `helper-functions.ts`) was only used by v1 and was deleted with it.

## How this is kept from coming back

`eslint.config.mjs` fails any import from `v1/` or from a root `lib/` inside `v2/`:

```
'../../lib/basepage' import is restricted from being used by a pattern.
v1 y lib/ de la raíz fueron retirados: usá los módulos dentro de v2/
```

## Recovering v1

The last commit that still contains v1 is tagged **`v1-legacy-retired`**:

```bash
git show v1-legacy-retired --stat          # what the repository looked like
git checkout v1-legacy-retired -- v1 lib   # bring the legacy files back, if ever needed
```

Nothing in v2 depends on them, so a recovery is only useful as a historical reference.
