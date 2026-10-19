# Configure Shipment and the carrier matrix

Which carriers and ship methods of a warehouse actually work? The carrier matrix answers it
through the **Configure Shipment** panel of the shipper view: one test per ship code (or
carrier + ship method), one row per test in a report that also says what changed since the
previous run.

## Configure Shipment as the suite drives it

`XenvioConfigureShipmentPanel` (`v2/page-objects/components/xenvio-configure-shipment-panel.ts`)

| Field | PrimeNG control | Methods | Covered before the matrix |
|---|---|---|---|
| Ship Code | `p-select#shipCode` (`shippingMethodConfig`) | `selectShipCode`, `selectShipCodeExact`, `listShipCodeOptions` | multibox test (EUSEM) |
| Carrier | `p-select#carrier` (`carrierAccount`) | `selectCarrier`, `selectCarrierExact`, `listCarrierOptions` | no |
| Ship Method | `p-select#shipMethod` (`shippingMethod`) | `selectShipMethod`, `selectShipMethodExact`, `listShipMethodOptions` | no |
| Package Type | `p-select#packageType` (`packageType`) | `selectPackageType`, `selectPackageTypeExact` | no |
| What the four show | — | `readSelection()` | no |
| Include return label + Set label info | `p-checkbox#isAutoReturnLabel` | `configureReturnLabel` (→ `XenvioReturnLabelForm`) | return label test |
| Address Type (Residential / Commercial) | `p-selectButton` | — | no |
| Saturday Delivery | `p-checkbox` | — | no |
| Clear All / Revalidate | `p-button` | — | no |

Findings from the analysis:

- **The configured ship code is not verified.** The multibox test selects EUSEM, then GET RATES
  and `selectFirstRate()`: the label is bought with whatever rate comes first, which may be
  another carrier. The matrix selects the rate card of the configured method instead
  (`pickMatchingRate`).
- **`selectShipCode` / `selectCarrier` build a regex from the text.** A carrier named
  `Stamps.com` or `UPS (Test)` matches the wrong option or none. The `*Exact` methods match
  the whole text literally and pick among repeated texts (`occurrence`).
- **`expandPanel` checked the first `p-accordion-content` of the page**, which can belong to
  another panel, so it could skip expanding Configure Shipment. It now checks the panel's own
  Ship Code dropdown (it was unused until the matrix).
- **Fixed 500 ms waits after each selection.** Ship Methods load after the Carrier is chosen;
  the `*Exact` methods wait for the Xenvio loader instead.
- **No way to read the panel or the rates.** `readSelection()` and
  `XenvioRatesModal.readOfferedRates()` (which does not fail when there are no rates) were added.
- Address Type, Saturday Delivery, Clear All and Revalidate have no tests yet.

## The carrier matrix

```text
npm run carriers:discover          Configure Shipment → data/carrier-matrix/<warehouse>.json
        ↓ (review the file: enable/disable entries, add notes)
npm run carriers:matrix            one test per enabled entry — rates mode, nothing is bought
npm run carriers:matrix:labels     same, buying each label and voiding it
        ↓
carrier-matrix-report/latest-<mode>.md   + Allure: Suites → Carrier Matrix → carrier → method
```

Each test:

```text
OrderBuilder.domestic() → apiOrders.createOpenOrder()      POST /api/v3/orders/new (create_label: false)
ShipmentNavigationService.openByUrl()                      shipper view of that shipment
probeCarrierEntry()                                        v2/workflows/carrier-probe-workflow.ts
    Configure Shipment: Ship Code, or Carrier + Ship Method (+ Package Type)
    readSelection()          → carrier / method / package type the panel shows
    GET RATES → readOfferedRates() → pickMatchingRate(method)
    label mode: select that rate → SAVE & CONFIRM → GET LABELS → VOID
```

### Discovery

`v2/carrier-matrix/discover-carriers.spec.ts` opens an open order and reads:

- every **Ship Code** option, selecting each one to record the Carrier / Ship Method / Package
  Type it fills in;
- every **Carrier** option and its **Ship Method** options.

```json
{
  "warehouse": "qa20",
  "discoveredAt": "2026-10-19T12:00:00.000Z",
  "entries": [
    { "id": "code:EFEXG", "kind": "shipCode", "shipCode": "EFEXG", "carrier": "ezFedex Test",
      "method": "FedEx Ground", "packageType": "Your Packaging", "enabled": true },
    { "id": "code:EUSPMD#2", "kind": "shipCode", "shipCode": "EUSPMD", "occurrence": 2, "carrier": "RatesUSPS",
      "method": "Priority Mail", "enabled": true, "note": "Repeated ship code: ..." },
    { "id": "method:ezFedex Test › FedEx 2Day", "kind": "carrierMethod", "carrier": "ezFedex Test",
      "method": "FedEx 2Day", "enabled": true }
  ]
}
```

Disabled by default (still listed, so they can be enabled by hand):

- carrier + method pairs a ship code already covers (`"note": "Covered by ship code EFEXG."`);
- international methods — the probe order is domestic, they would get no rate.

Running discovery again keeps the `enabled` and `note` edited by hand. Commit the file: it is
the list of what the warehouse should support.

### Running it

```bash
npm run carriers:matrix                              # every enabled entry, rates mode
npm run carriers:matrix -- -g "FedEx"                # only titles matching FedEx
npm run carriers:matrix -- --workers=4               # in parallel (one order per test)
CARRIER_MATRIX_SHIP_CODES="EFEXG,EUSEM" npm run carriers:matrix   # no file needed
npm run carriers:matrix:labels                       # buy + void each label
```

| Variable | Use |
|---|---|
| `CARRIER_MATRIX_MODE` | `rates` (default) or `label` |
| `CARRIER_MATRIX_SHIP_CODES` | Comma list of ship codes; replaces the file |
| `CARRIER_MATRIX_FILE` | Matrix file (default `data/carrier-matrix/<WAREHOUSE_XENVIO>.json`) |
| `CARRIER_MATRIX_ALLOW_PRODUCTION` | `1` lets label mode use production-like accounts |
| `XENVIO_API_TOKEN`, `API_ORDER_SHIP_CODE` | API v3 setup order (see [16-api-assisted-test-setup.md](16-api-assisted-test-setup.md)) |

### Statuses

| Status | Meaning | Where to look |
|---|---|---|
| ✅ `works` | rates: the method got a rate · label: label bought and voided | — |
| ⚠️ `rate-not-offered` | rates came back, none for this method | "Offered rates" attachment; "Carrier errors (View Requests)" |
| ❌ `no-rates` | the shipment got no rates at all | `[EXTERNAL CARRIER]` reason in the row / Allure |
| ❌ `label-failed` | GET LABELS rejected (carrier message in the row) | "Carrier errors (View Requests)" |
| 🛑 `void-failed` | **the label was bought and is still active**: void it by hand | shipment link in the row |
| 🧩 `config-error` | Configure Shipment could not select the entry, or shows no method | "Configure Shipment" screenshot |
| 💥 `error` | setup, timeout or automation problem | test error |
| ⏭️ `skipped` | disabled entry, or production-like account in label mode | the note |

A test passes only when its entry works, so a red test is a carrier/method to look at. The
`carrierDiagnostics` fixture still reads View Requests on every failure, and its carrier
reason is copied into the matrix row.

### Output

- **Console**: the whole matrix at the end of the run.
- **`carrier-matrix-report/latest-<mode>.md`** (and `.json`): this run. The next run of the same
  mode is compared with it: 🔻 worked before and fails now, 🔺 fixed.
- **`carrier-matrix-report/history/`**: every run, to follow a carrier over time.
- **Allure**: Suites → Carrier Matrix → carrier → ship method, with screenshots, offered rates
  and carrier errors per test.

`carrier-matrix-report/` is git-ignored.

### Safety

- **Rates mode buys nothing.** Use it for the routine health check.
- **Label mode buys a label per entry and voids it.** Production-like accounts (`Production…`,
  `…prod`, `… live`) are skipped unless `CARRIER_MATRIX_ALLOW_PRODUCTION=1`; the guard runs on the
  file and again on the carrier the panel shows. A `void-failed` row means a label to void by hand.
- Every test leaves an open `QA-API-…` order (orders cannot be deleted); in label mode it is
  voided. Nothing in the carrier configuration is changed.

## Limits — what to confirm against the Xenvio code

The matrix was built from what the suite already knows of the UI; these points depend on the
backend/frontend and are worth confirming when the code is at hand:

- **Rate matching is by method name.** If a rate card names the method differently from the
  Ship Method dropdown (`FedEx Ground` vs `Ground`), the row says `rate-not-offered` while the
  "Offered rates" attachment shows the rate. With the rates response contract (shipping method
  id per rate) the match can be exact.
- **Selecting a Ship Code is assumed to fill Carrier / Ship Method.** When it does not, the
  entry is a `config-error` ("shows no Ship Method").
- **Is the Ship Code list filtered by the selected carrier?** Discovery reads it once, on an
  order created with `API_ORDER_SHIP_CODE`; if the list depends on the carrier, codes of other
  carriers are missing from the file (their Carrier + Ship Method pairs are still there).
- **Does GET RATES rate only the configured method, or every carrier?** Either works, but
  rating only the configured one would make each probe faster.
- **Domestic only.** International methods need an international API v3 order (customs).
- **A faster, API-only matrix** (rate each carrier account without the UI) needs the rates
  endpoint and payload of the shipper view; the UI matrix does not depend on them.

Code: `domain/carriers/carrier-matrix.ts` (entries, rate matching, report — unit tested in
`unit/carrier-matrix.unit.spec.ts`), `config/carrier-matrix-config.ts`,
`workflows/carrier-probe-workflow.ts`, `carrier-matrix/` (specs and reporter).
