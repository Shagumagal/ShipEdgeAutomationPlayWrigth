# Xenvio v2: scalable architecture

The v2 suite is organized around business capabilities. All v2 scenarios consume the
services directly; `XenvioWorkflows` remains only as a temporary compatibility facade
for external callers.

```text
v2/tests                         scenarios and assertions
    ↓
v2/lib                           fixtures (page-object-fixtures) + compatibility facades
    ↓                            (top layer: nothing below may import it)
v2/runtime/XenvioSession         services bound to one Shipper View page
    ↓
v2/services                      business use cases by capability
    ↓               ↘
v2/workflows          ↘          browser orchestration of multi-step tasks (labels, void, retry)
    ↓                   ↘
v2/page-objects   v2/infrastructure   selectors & UI  |  network capture, saved sessions
    ↓                   ↓
v2/parsers  ·  v2/diagnostics  ·  v2/test-data  ·  v2/evidence
    ↓
v2/domain                        pure business knowledge: ports, package plans, carrier errors
```

### Folder map

| Folder | What goes here | May use Playwright? |
|---|---|---|
| `domain/` | Pure rules and knowledge (`carriers/`: error classification, retry policy; `packages/`; order ports) | No |
| `parsers/` | Pure parsing/formatting of Xenvio responses and console loggers | No |
| `test-data/` | Immutable data builders | No |
| `diagnostics/` | Failure reporting: carrier failure text + redaction (pure) and the monitor fixture logic | Monitor only |
| `evidence/` | Allure evidence for passing scenarios | Yes |
| `infrastructure/` | Technical plumbing: in-page network capture, saved-session storage | Yes |
| `page-objects/` | Selectors and single UI interactions | Yes |
| `adapters/` | Implementations of domain ports (UI today, API later) | Yes |
| `workflows/` | Multi-step browser orchestration (GET LABELS, VOID, return label, core → Xenvio import, carrier retry runner) | Yes |
| `services/` | Business use cases by capability | Yes |
| `runtime/` | `XenvioTestContext` / `XenvioSession`: services bound to one page | Yes |
| `lib/` | Playwright fixtures and backward-compatible facades (top layer) | Yes |

Language rule: code, logs and thrown errors are in English. Texts QA reads in Allure
(category names and descriptions, the `[CARRIER EXTERNO] ...` reason, attachment notes)
are in Spanish.

## Capability services

- `SessionService`: authentication and opening Shipper View.
- `OrderService`: transport-independent order creation.
- `ShipmentNavigationService`: navigation to shipment detail through the UI.
- `PackageService`: item and box preparation.
- `RatesService`: requesting, selecting and confirming rates.
- `LabelService`: generating and voiding labels.
- `CarrierService`: carrier creation and verification.
- `ShipmentConfigurationService`: return-label and ship-code configuration.

Normal scenarios should use the `xenvio` fixture. Specialized scenarios that do not
open a standard session may import the smallest required services from `v2/services`.
`XenvioWorkflows` must contain delegation only and should not be imported by v2 specs.

All current v2 specs enter Xenvio through this fixture. They must not repeat login,
dashboard or shared configuration fixtures in their own parameter lists.

## Central fixture and session

Tests that need a normal Xenvio session should consume the `xenvio` fixture. It loads
and validates the environment configuration, performs login and binds services to the
Shipper View popup:

```typescript
test('order to label', async ({ xenvio }) => {
    const session = await xenvio.openSession();

    const shipmentNumber = await session.orders.createStandardOrder(
        recipient,
        StandardPackage,
        session.config.warehouse,
    );

    const orderPage = await session.shipments.waitForDetailAfterCreation(shipmentNumber);
    await session.packages.addItemDetails(orderPage, item);
    await session.rates.request(orderPage);
    await session.labels.generate(orderPage);
});
```

The required variables are validated by `v2/config/xenvio-config.ts`. Specs should not
read `process.env` directly for the shared Xenvio URL, credentials, app or warehouse.

### Reusable login (one session per worker)

The first test of each Playwright worker logs in through the UI and saves its cookies to
`.auth/xenvio-worker-<parallelIndex>.json` (gitignored). The following tests of that same
worker reuse them and skip the login form. `global-setup.ts` clears `.auth/` at the start
of every run, so each run starts with fresh sessions.

Sessions are never shared between workers on purpose: Xenvio keeps per-session state, and
two tests running at the same time on one session picked up each other's shipment.

`openSession()` injects the worker's cookies and checks that Xenvio opens on the dashboard.
If anything is off (no file, expired or rejected session, login form shown), it removes the
injected cookies and performs the regular UI login. ShipEdge Core cookies (`BASE_URL` host)
are never saved.

- Disable it with `XENVIO_REUSE_AUTH=false` (every test logs in through the UI).
- Storage: `v2/infrastructure/xenvio-auth-state.ts` (`XenvioAuthStore`, one per worker, created by the
  `xenvio` fixture); login flow and fallback: `SessionService`. Covered by
  `v2/unit/xenvio-auth-state.unit.spec.ts`.

## Test-data builders

Domestic test scenarios should compose their data with the builders under
`v2/test-data`:

```typescript
const { recipient, product, boxesCount } = OrderBuilder.domestic()
    .withProduct(PackageBuilder.small().build())
    .withBoxes(3)
    .build();
```

- `RecipientBuilder` owns random, state-specific and known recipient variants.
- `PackageBuilder` owns standard, small and random package dimensions.
- `OrderBuilder` composes recipients, packages and box count into one scenario.

Builders return copies instead of shared mutable objects. Existing generators under
`lib/test-data.ts` remain available for legacy callers while v2 specs use the builders.

Package builders also produce a `DomesticPackagePlan` with separate `box` and `item`
data. The plan is validated before the UI is touched: positive values are required,
the total item weight cannot exceed the box weight, and item dimensions cannot exceed
box dimensions. Multibox rate scenarios use `carrierSafeMultiBox()` so the declared
contents remain physically coherent with every box.

## Creating an order through a port

`OrderService` depends on `OrderCreationPort`, not on Playwright or a page object:

```text
OrderService → OrderCreationPort ← PrimeNgOrderCreationAdapter
                              ↖ future ShipEdgeApiOrderCreationAdapter
```

The current low-level UI composition is:

```typescript
const orderService = createPrimeNgOrderService(popupPage);

const shipmentNumber = await orderService.createStandardOrder(
    recipient,
    StandardPackage,
    config.warehouse,
);
```

A future API implementation only needs to implement `OrderCreationPort`. The scenario
continues calling `orderService.createStandardOrder(...)`; only the composition changes:

```typescript
const orderService = new OrderService(new ShipEdgeApiOrderCreationAdapter(apiClient));
```

The concrete API adapter is intentionally not implemented yet because its endpoint,
authentication and request/response schema must come from the real ShipEdge API contract.

## Dependency rules

1. Dependencies point down the diagram above; there are no cycles between folders.
2. `domain/` and `parsers/` are pure: no Playwright, no Allure, no I/O. Their rules are unit tested.
3. Nothing below `lib/` imports from `lib/`. Services import workflows and parsers directly,
   never through the compatibility facades.
4. Services, workflows and infrastructure receive what they need as parameters (e.g. the
   worker's `XenvioAuthStore` is created by the fixture); they do not call `test.info()`.
5. Adapters implement domain ports and translate them to UI or API operations.
6. Page objects expose UI interactions and do not own complete business scenarios.
7. Network interception remains centralized in `v2/infrastructure/network-capture.ts`.
8. Reporting (`diagnostics/`, `evidence/`) may read domain knowledge; business flows never
   depend on reporting.

When an API adapter is introduced, place it under `v2/adapters/api` and depend on an
interface owned by the service. This allows the same business setup to run through API
while keeping the UI adapter focused on user-visible behavior.

## Shipment result processing

The former `shipment-result-parser.ts` remains as a small compatibility facade. Its
implementation is separated under `v2/parsers`:

- Result contracts live in `shipment-result-types.ts`.
- Label and void responses are parsed by pure parser modules.
- Network/UI orchestration lives in `v2/workflows/get-labels-workflow.ts` and `void-label-workflow.ts`.
- Console presentation lives in dedicated result and shipment-state loggers.

Consumers keep the existing imports while parsing, orchestration and presentation can
now be tested and evolved independently.

## Label evidence

`v2/evidence/LabelEvidenceService` is the reporting boundary for generated labels. It
accepts a shipment with one or more boxes, and each box can contain a forward label,
a return label, or both. The same contract therefore covers individual, return-label
and multibox scenarios without duplicating reporting code.

Before marking the evidence as valid, it verifies the shipment identity and shipped
state, box tracking numbers, unique box/document entries, the visible post-generation
UI state, and every downloaded PDF. Allure receives the complete evidence manifest,
one PDF per label, a final page screenshot and a focused screenshot of the visible UI
success indicator. URLs are intentionally preserved because this suite operates with
isolated test environments and accounts.

Evidence code stays outside `v2/services`: business label generation must not depend
on Allure or screenshot concerns.

## Return label workflow

GET LABELS with a configured return label fires two `task_executor` calls. The flow is split
the same way as `get-labels-workflow.ts`:

- `v2/infrastructure/network-capture.ts` → `injectReturnLabelInterceptor` / `readReturnLabelCapture` /
  `resetReturnLabelSlots` / `restoreReturnLabelInterceptor` (all `window.fetch` patching lives here).
- `v2/workflows/return-label-workflow.ts` → browser orchestration: click, poll, retry once with
  "GET RETURN LABEL" **only for retryable errors**, always restore `fetch`.
- `v2/parsers/return-label-parser.ts` → pure decisions and parsing (no Playwright, no evidence imports).
- `LabelEvidenceService.fromReturnLabelResult(...)` → builds the evidence (dependency goes
  evidence → parsers, never the other way).
- Exposed as `session.labels.generateWithReturnLabel(orderPage)`.

Specs keep only the business assertions and call `LabelEvidenceService.capture(...)`.

### Retry policy

Only codes in `RETRYABLE_RETURN_LABEL_CODES` (today: `1008`) trigger the retry. Detection is
tolerant because the API returns errors in several shapes: an object with `code`, or a string
containing JSON with `error_code`. Any other error (for example the carrier rejection `800000`
"The is_return_label specified is invalid.") is NOT retried: the spec fails immediately and the
assertion message includes the carrier code and message. The evidence records the real initial
error in `details.initialReturnLabelError`. To make another code retryable, add it to the list and
add a case to `v2/unit/return-label-parser.unit.spec.ts`.

## Carrier error diagnostics

Xenvio logs every HTTP call it makes to any carrier (EasyPost, FedEx, UPS, PowerShip, Ehub, ...)
with `shipment.save_log2` into the `outgoings` table. The UI shows it in *History → View
Requests*, and `GET /shipments/:id/view_requests2` returns it as JSON with the browser session
cookies. Because every carrier goes through the same log, diagnostics need no per-carrier code.

The auto fixture `carrierDiagnostics` (`v2/diagnostics/carrier-error-monitor.ts`) runs in every
v2 test:

1. While the test runs it records the shipments touched and any `task_executor` call answered
   with `400 { error }`.
2. Only if the test fails, it reads `view_requests2` for those shipments and attaches
   **"Carrier errors (View Requests)"** to Allure: failed carrier calls since the test started
   (carrier, status, code, message, request/response bodies) plus the Xenvio task errors.
   Credentials are masked (Authorization, API keys, secrets, XML `<Password>`/`<Key>`, ...), and
   an empty Basic auth header (`Basic Og==`) is flagged as "empty credentials".
3. It prefixes the test error with `[CARRIER EXTERNO] ...` only on strong evidence, and Allure
   files it under **"Error externo de carrier"**:
   - a Xenvio task was rejected by the carrier (`carrier response error`, `Carrier error message`,
     or an embedded carrier URL such as the EasyPost refund of a void), or
   - the rates modal shows "No shipping rates are available" and carrier calls failed.

Errors in the log alone never classify a failure: rate shopping queries many carriers and some
fail on every run. Such a failure keeps its original category, with the attachment as context.
Unknown carriers are named by hostname; add a host to `KNOWN_CARRIER_HOSTS` for a friendlier name.
Carrier knowledge (identification, message extraction, classification) lives in
`v2/domain/carriers/carrier-errors.ts`; the report text and redaction in
`v2/diagnostics/carrier-failure-report.ts`. Both are unit tested with the real View Requests
samples in `v2/unit/fixtures/carrier-samples.ts`.

### Retry on transient carrier errors

GET LABELS, VOID LABEL and the automatic return label are retried **once** (after 5s) only
when a failed `task_executor` response was received **and** the error comes from the carrier
**and** it looks transient (carrier API with no valid response, timeout, 5xx, "try again",
rate limit) with nothing pointing to a permanent problem (credentials, missing rate, invalid
address). Unknown errors, Xenvio's own errors (e.g. shipment locks) and timeouts without a
response are never retried: a retry must not hide a configuration problem or buy a second label.

- Policy (pure, unit tested): `v2/domain/carriers/carrier-retry-policy.ts`
  (`MAX_TRANSIENT_CARRIER_RETRIES`, `TRANSIENT_RETRY_DELAY_MS`, transient/permanent patterns).
- Runner: `v2/workflows/carrier-retry-runner.ts` watches the failed-response slot of
  `injectFetchInterceptor` while the original UI wait runs, so a carrier error is detected
  immediately. A non-retryable error now fails the step at once with the carrier message
  instead of waiting for the UI timeout (up to 180s).
- Each retry is visible even when the test passes: Allure step
  "Retry <action> after transient carrier error" with the error attached.
- The main label inside the return-label flow (`getLabelsWithReturnLabel`) keeps its previous
  behavior; only its return-label call gained the transient retry.

## Unit tests (no browser)

Pure logic (parsers, builders, package coherence) is tested in `v2/unit/*.unit.spec.ts` through the
`unit` Playwright project. No browser is launched and the QA environment is never touched:

```bash
npm run test:unit
```

New pure modules should get a `*.unit.spec.ts` next to the existing ones. Services that drive
page objects are intentionally not unit tested; they are covered by the e2e suite.
