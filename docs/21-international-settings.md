# International Settings test

`v2/tests/xenvio-shipper-view-international-settings.spec.ts` (`@e2e @labels @shipment-config`)
checks that what the Shipper View saves in **International Settings** (incoterm and tax
identifiers) reaches the carrier when the label is generated, and that the label result is priced
and documented correctly. Carrier: ezUSPS (EasyPost), ship code `EUSPMI` (Priority Mail
International).

One test per destination in `InternationalSettingsScenarios` (`v2/test-data/international-settings-scenarios.ts`):

| Test | Destination | Tax ID |
|---|---|---|
| `TC-Xenvio-IntlSettings-001` | EU (24 Rue de Rivoli, Paris, FR) | IOSS `IM2500000123` (IM + 10 digits), issuing country FR |
| `TC-Xenvio-IntlSettings-002` | UK (10 Downing Street, London, GB), Address 2 empty | UK VAT `GB123456789` (GB + 9 digits), issuing country GB |

Both use General Purpose *Sale / Permanent*, currency USD, incoterm DAP, tax id type VAT (the
only one USPS takes, shown as "VAT/IOSS") and entity SENDER. Adding a destination to the list adds
a test; nothing else changes.

## Flow

```text
API v3 (setup)        open order: ship code INTL_LABEL_SHIP_CODE, US sender (106 Capitola Dr,
                      Durham NC), item with HS code, origin US, price and weight > 0
Shipper View          open the shipment by URL
                      International Settings → SAVE & CONFIRM (confirmed by the task_executor answer)
                      GET LABELS (label result captured from task_executor)
View Requests         POST /v2/shipments and /v2/shipments/shp_…/buy of every box (EasyPost)
Commercial invoice    the PDF of the shipment, downloaded and read as text (pdfjs-dist)
```

The order is setup, so it is created through API v3 (see [16](16-api-assisted-test-setup.md));
the UI is used for what the test covers. International Settings only travel to the carrier at
GET LABELS, which is why they are saved first.

## What the test asserts

Each block is a product contract (`intl-settings.*` in `domain/contracts/product-contracts.ts`),
so a failure becomes a product defect candidate with its evidence
([20](20-product-defect-candidates.md)).

| Test case point | Contract | Checks |
|---|---|---|
| Save | `intl-settings.save.persisted` | The SAVE & CONFIRM answer has `shipmentType`, `currencyIsoCode`, `services.incoterm` and `services.taxIdentifiers` (entity, taxId, taxIdType, issuingCountry) as filled |
| 4.1 Label result | `intl-settings.label.shipment-result` | Services kept after GET LABELS; `finalPostage > 0` and equal to `shippingCost`; one commercial invoice document (`type: invoice`, `application/pdf`) per form EasyPost returned. Shipped state, tracking per box and real PDF labels are checked by `LabelEvidenceService` (the label PDFs are attached) |
| 4.2 Request to EasyPost | `intl-settings.carrier.request` | `to_address` = recipient and `from_address` = merchant (name, company, streets, city, state, zip, country, phone, email, as Xenvio maps them — see below); `options.incoterm`, `tax_identifiers` (the 4 values sent), `customs_info.contents_type = merchandise` and the customs line by HS code: origin country, quantity, value (price × quantity) |
| 4.3 EasyPost answer | `intl-settings.carrier.accepted` | The same addresses; `tax_identifiers[0]` with entity, type and country and `tax_id: "HIDDEN"` (EasyPost hides an accepted id); `options.incoterm = DAP`, `delivered_duty_paid = false`; a `commercial_invoice` form; `postage_label.label_url`; tracking code; `id` starting with `shp_` (the carrier_reference); `mode: test` |
| Commercial invoice PDF | `intl-settings.commercial-invoice.content` | Read as text: Sender and Recipient blocks (name, company, street, city, state, zip, country) with their phone and email; the tracking code of a box of the shipment; the customs line by HS code (quantity, origin, description, unit value, subtotal); Total Declared Value; Currency Code; Terms of Trade starting with the incoterm. The PDF and its text are attached |

Customs lines are matched **one to one**, in the EasyPost request and in the invoice: each expected
line takes its own line, and a line left over (another product, or the same one twice) fails, as
does an item table that is not made of whole 7-column rows. Without that, an extra or duplicated
product would pass because every expected line is still found.
| 4.4 Final postage | `intl-settings.final-postage` | `finalPostage` = Σ per box of `selected_rate.rate` + fees that are `charged`, not `refunded` and not `PostageFee`. The InsuranceFee of $1.00 counts even with `insurance: 0` (account setting), so the test never expects `finalPostage == rate` |

Verified on x52 / qa22 on 2026-10-22: FR → rate 114.53 + InsuranceFee 1.00 = **115.53** (same as
order 319), tracking `CA00…US`, commercial invoice attached.

**Not automated:** what the **label** prints, e.g. the tax id in the CP72 "Exporter's reference"
box (4.5, optional). The USPS international label is a single image inside the PDF (no text), so it
would take OCR. It stays as visual evidence: the label PDF is attached to the report. The
commercial invoice does not print the tax id either (it is not part of its template).

Evidence in the report: the label PDF, the commercial invoice PDF and its text, the EasyPost calls
(View Requests, credentials masked) and the final full-page screenshot. The "VOID SHIPPING LABELS"
button crop the other label tests attach is left out here (`uiProof: 'none'`): it only shows that
the shipment is shipped, which the label result already proves.

## Configuration (.env)

| Variable | Use |
|---|---|
| `INTL_LABEL_WAREHOUSE` | Warehouse of the orders, e.g. `qa22` |
| `INTL_LABEL_SHIP_CODE` | International ship code, e.g. `EUSPMI` |
| `INTL_LABEL_TAX_ID_CARRIER` | Optional: carrier group of the Tax ID Type list for that ship code (default `USPS`) |
| `XENVIO_EMAIL` + `XENVIO_API_TOKEN` | API v3 credentials for the order setup. `API_ORDER_SHIP_CODE` is **not** needed: the order goes with `INTL_LABEL_SHIP_CODE` |

Without the first two the test is **skipped**; with only one of them it fails (configuration
error). Like `API_ORDER_SHIP_CODE`, the ship code must exist **once** among the warehouse's
active carriers and belong to an EasyPost **test** account: the API takes the first carrier with
that code and the label is bought. In x52/qa22 (checked 2026-10-22) `EUSPMI` exists only in
account `ezusps` (test key). The test also fails if EasyPost answers in a mode other than `test`.

The user must have **Send to PrintX** off: when it is on and the warehouse's PrintNode key is
invalid, GET LABELS shows an unrelated 401.

## Behavior worth knowing

- **The sender must be explicit.** With a blank merchant the API copies the warehouse address;
  qa22's has `zip: "test@send.com"`, and EasyPost then returns no rate ("The label can't be
  generated, the shipping method requested has no rate"). The scenarios send `UsMerchant`.
- **SAVE & CONFIRM right after an edit sends the previous values.** The panel reports changes
  500 ms after the last edit (`debounceTime(500)`); a save inside that window went out with
  `entity: ""` and `issuing_country: ""` and the backend answered 400 *tax_identifier required
  fields missing*. The page object waits for the debounce; the save answer confirms it. A user
  who clicks that fast hits the same 400.
- **Tax ID Type is grouped by carrier.** The same code (VAT) is in several groups, so the option is
  picked inside the carrier group. Once selected, the select shows the label of the *first* VAT
  in the list ("VAT: A Value Added Tax number"), not the clicked "VAT/IOSS: …": the value is the
  same (`VAT`). Its options have the accessible name `[object Object]` (PrimeNG `aria-label` of
  an object), so they are matched by text, not by role name.
- **Xenvio rewrites two address fields for EasyPost** (EasyPost `MonoboxCarrierRequestMapper`),
  and the test expects them that way (`toEasyPostAddress`):
  - the phone goes as its **last 10 digits**: the FR recipient `33142685500` goes (and is printed
    on the invoice) as `3142685500`;
  - a **name without a space** gets `" ."` as a last name: `OrderInternational` goes as
    `OrderInternational .`.
- **View Requests** (`GET /shipments/:id/view_requests2`) keeps every carrier call; `reference`
  is the box id in both the create and the purchase, which is how each box is paired with its
  calls. A retried box keeps only its latest purchase. The evidence is attached as
  "EasyPost label calls (View Requests)" with credentials masked (the log headers carry the
  EasyPost API key).

## Code map

| Layer | File |
|---|---|
| Scenario | `v2/tests/xenvio-shipper-view-international-settings.spec.ts` |
| Test data | `v2/test-data/international-settings-scenarios.ts` (scenarios, `UsMerchant`, `CustomsPackagePlan`, `CustomsData`) |
| Fixtures | `apiOrders` (`createOpenOrder`), `carrierRequests`, `shipmentDocuments` in `v2/lib/page-object-fixtures.ts` |
| Services | `ShipmentConfigurationService.configureInternationalSettings` (also `session.configuration`), `CarrierRequestService`, `ShipmentDocumentService` (download, attach and read a PDF), `ApiOrderService.createOpenOrder` |
| Page object | `v2/page-objects/components/xenvio-international-settings-panel.ts` (`orderToLabelPage.internationalSettings`) |
| Domain (pure, unit tested) | `domain/shipments/international-settings.ts`, `domain/carriers/easypost-label-log.ts` (calls, addresses, final postage), `domain/carriers/easypost-commercial-invoice.ts`, `domain/orders/api-order.ts` (merchant + customs) |
| Infrastructure | `XenvioApi.listShipmentRequests`, `pollCapturedTaskResult` (network-capture), `readPdfText` (`pdf-text.ts`, pdfjs-dist) |
| Unit tests | `v2/unit/international-settings.unit.spec.ts`, `v2/unit/easypost-label-log.unit.spec.ts`, `v2/unit/commercial-invoice.unit.spec.ts` (with the text of a real invoice in `v2/unit/fixtures/commercial-invoice-sample.ts`) |

## Running it

```bash
npx playwright test v2/tests/xenvio-shipper-view-international-settings.spec.ts --project=xenvio-v2 --workers=1
npx playwright test --grep "TC-Xenvio-IntlSettings-002" --project=xenvio-v2 --workers=1
```

About 40 seconds to 1 minute per destination. Each run leaves one shipped test-mode order per destination in
the warehouse (`QA-API-<date>-<time>-<random>`); orders cannot be deleted.
