# API-assisted test setup (planned)

Status: design saved for a future implementation. No API calls are active yet.

## Goal

Use the existing ShipEdge order-creation request from Postman as test setup, then
validate label and void behavior through the Xenvio UI. This reduces UI setup time
without removing coverage from the behavior under test.

```text
OrderBuilder
    ↓
ShipEdgeOrdersApi.createOrder()
    ↓ returns order number / external ID
ImportedOrderWaiter.waitUntilAvailable()
    ↓ polling, no fixed sleep
XenvioSession.shipments.searchAndOpen()
    ↓
generate label through UI, when needed
    ↓
void label through UI
    ↓
assert UI and captured API state
```

## Proposed modules

```text
v2/adapters/api/
├── shipedge-api-client.ts
├── shipedge-order-creation-adapter.ts
└── imported-order-waiter.ts
```

The API adapter will implement the existing `OrderCreationPort`. Tests will use
Playwright `APIRequestContext`; Postman will remain the source for confirming the real
endpoint, authentication, headers, body and response contract.

## Required information before implementation

1. Sanitized Postman request or exported collection.
2. Authentication method and environment variable names.
3. Example successful response.
4. Field that maps the created order to Xenvio search: order number, external ID,
   shipment number or reference number.
5. Expected import delay and terminal failure responses.

If the API only creates an unshipped order, the test must still request rates and
generate a label in Xenvio before voiding it. If the API can create an already-labeled
shipment, the UI scenario can search it and test void directly.

Secrets, tokens and credentials must remain in `.env` or CI secrets and must never be
attached to Allure.
