# API-assisted test setup

Tests create their preconditions through Xenvio API v3 and use the UI only for the behavior
under test. The void test is the first one: the API returns the order already shipped and
the UI voids it (≈30 s instead of ≈1.5 min, and no rates/label UI steps that can fail for
reasons unrelated to void).

```text
OrderBuilder.domestic()
    ↓
apiOrders.createShippedOrder()        POST /api/v3/orders/new (create_label: true)
    ↓ shipment number + tracking + warehouse id
ShipmentNavigationService.openByUrl() shipper-view?shipment_number=…&warehouse_id=…&app_id=0
    ↓
LabelService.void()                   UI: VOID SHIPPING LABELS → Delete
```

## In a test

```ts
test('...', async ({ xenvio, apiOrders }) => {
    const shipped = await apiOrders.createShippedOrder(OrderBuilder.domestic().build(), xenvio.config.warehouse);
    const session = await xenvio.openSession();
    const orderPage = await ShipmentNavigationService.openByUrl(session.page, {
        shipmentNumber: shipped.shipmentNumber,
        warehouseId: shipped.warehouseId,
        appId: 0,
    });
});
```

An **open** order (no label) for a flow that needs the UI before GET LABELS, with its own ship
code, sender and customs data (see [21](21-international-settings.md)):

```ts
const order = await apiOrders.createOpenOrder({
    recipient, plan: CustomsPackagePlan, warehouse, shipCode,
    merchant: UsMerchant, customs: CustomsData, sampleLabel: true,
});
```

## Configuration (.env)

| Variable | Use |
|---|---|
| `XENVIO_EMAIL` + `XENVIO_API_TOKEN` | `Email` / `Token` headers of API v3 (the user's access token) |
| `API_ORDER_SHIP_CODE` | Default ship code of the orders the API ships (`createShippedOrder`, e.g. the void test), e.g. `EFEXG` (ezFedex Ground in qa20). Only that method requires it, and it fails before calling the API when it is missing; `createOpenOrder` takes its ship code from the test |

The ship code must exist **only once** among the warehouse's active carriers and belong to a
**test** carrier account: the API takes the first config with that code, and qa20 has codes
repeated across accounts (e.g. `EUSPMD` in two `RatesUSPS` and in `ProductionCarrier_EZ_USPS`).

## Behavior worth knowing

- QA answers `{ orders: [order] }`. A label the carrier refused still answers
  `status: 'Success'`; the carrier message is in `shipments[0].errors` and the test fails with it.
- A transient carrier error (e.g. `SHIPMENT.POSTAGE.TIMED_OUT`) is retried once with a new order,
  following `domain/carriers/carrier-retry-policy.ts`. The failed order stays unshipped in QA.
- A blank merchant address makes the API use the warehouse address as the sender; the phone is
  not copied, so the payload sends one (FedEx rejects labels without it: `PHONENUMBER.EMPTY`).
- Orders are numbered `QA-API-<date>-<time>-<random>` (shipment `…-S1`), so they are easy to
  find. Orders cannot be deleted; voided ones are harmless.
- A shipped shipment shows only VOID SHIPPING LABELS in the action bar (no GET RATES), which is
  why `openByUrl` waits for either button.

Code: `domain/orders/api-order.ts` (payload and response, unit tested),
`infrastructure/xenvio-orders-api.ts` (HTTP), `services/api-order-service.ts` (retry and steps).
