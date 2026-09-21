# Xenvio v2: scalable architecture

The v2 suite is organized around business capabilities. All v2 scenarios consume the
services directly; `XenvioWorkflows` remains only as a temporary compatibility facade
for external callers.

```text
v2/tests                         scenarios and assertions
    ↘ v2/evidence                 reusable, strict Allure evidence
    ↓
v2/test-data                     immutable builders for recipients, packages and orders
    ↓
v2/lib/page-object-fixtures      validated config and Xenvio test context
    ↓
v2/runtime/XenvioSession         services bound to one Shipper View page
    ↓
v2/services                      business use cases by capability
    ↓                       ↘
v2/domain ports             v2/lib infrastructure
    ↑
v2/adapters/ui                  PrimeNG implementation of a port
    ↓
v2/page-objects                 selectors and UI interactions
```

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

1. Tests may depend on services, page-object fixtures and shared test data.
2. Transport-independent services depend on domain ports, never on Playwright.
3. UI-oriented services may orchestrate page objects and infrastructure utilities.
4. Adapters implement domain ports and translate them to UI or API operations.
5. Page objects expose UI interactions and do not own complete business scenarios.
6. Infrastructure code does not import tests or services.
7. Network interception remains centralized in `v2/lib/network-capture.ts`.

When an API adapter is introduced, place it under `v2/adapters/api` and depend on an
interface owned by the service. This allows the same business setup to run through API
while keeping the UI adapter focused on user-visible behavior.

## Shipment result processing

The former `shipment-result-parser.ts` remains as a small compatibility facade. Its
implementation is separated under `v2/parsers`:

- Result contracts live in `shipment-result-types.ts`.
- Label and void responses are parsed by pure parser modules.
- Network/UI orchestration lives in `get-labels-workflow.ts` and `void-label-workflow.ts`.
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

- `v2/lib/network-capture.ts` → `injectReturnLabelInterceptor` / `readReturnLabelCapture` /
  `resetReturnLabelSlots` / `restoreReturnLabelInterceptor` (all `window.fetch` patching lives here).
- `v2/parsers/return-label-workflow.ts` → browser orchestration: click, poll, retry once with
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

## Unit tests (no browser)

Pure logic (parsers, builders, package coherence) is tested in `v2/unit/*.unit.spec.ts` through the
`unit` Playwright project. No browser is launched and the QA environment is never touched:

```bash
npm run test:unit
```

New pure modules should get a `*.unit.spec.ts` next to the existing ones. Services that drive
page objects are intentionally not unit tested; they are covered by the e2e suite.
