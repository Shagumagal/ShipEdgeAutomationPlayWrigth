# Xenvio v2: scalable architecture

The v2 suite is organized around business capabilities while preserving the existing
`XenvioWorkflows` API during migration.

```text
v2/tests                         scenarios and assertions
    ↓
v2/services                      business use cases by capability
    ↓
v2/page-objects                  PrimeNG UI adapters
    ↓
v2/lib                           network capture, parsing and fixtures
```

## Capability services

- `SessionService`: authentication and opening Shipper View.
- `OrderService`: order creation and shipment navigation.
- `PackageService`: item and box preparation.
- `RatesService`: requesting, selecting and confirming rates.
- `LabelService`: generating and voiding labels.
- `CarrierService`: carrier creation and verification.
- `ShipmentConfigurationService`: return-label and ship-code configuration.

New scenarios should import the smallest required services from `v2/services`.
Existing scenarios may continue using `XenvioWorkflows`; it is a compatibility facade
and must contain delegation only, not business implementation.

## Dependency rules

1. Tests may depend on services, page-object fixtures and shared test data.
2. Services may orchestrate page objects and infrastructure utilities.
3. Page objects expose UI interactions and do not own complete business scenarios.
4. Infrastructure code does not import tests or services.
5. Network interception remains centralized in `v2/lib/network-capture.ts`.

When an API adapter is introduced, place it under `v2/adapters/api` and depend on an
interface owned by the service. This allows the same business setup to run through API
while keeping the UI adapter focused on user-visible behavior.
