# Xenvio v2: scalable architecture

The v2 suite is organized around business capabilities. All v2 scenarios consume the
services directly; `XenvioWorkflows` remains only as a temporary compatibility facade
for external callers.

```text
v2/tests                         scenarios and assertions
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
