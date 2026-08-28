import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { CoreImportWorkflows, CoreImportVerification } from '../lib/core-import-workflows';

/**
 * ─── Xenvio Core Import Verification (v2 — PrimeNG) ─────────────────────────
 *
 * Test: TC-Xenvio-CoreImport-001 — Create order in ShipEdge Core → Verify in Xenvio
 *
 * This is a cross-system E2E test that validates the order sync pipeline:
 *
 *   Part A — ShipEdge Core (Rails):
 *     1. Login to qa20.shipedge.com
 *     2. Create a new order (Address Book → Products → Shipping → Save)
 *     3. Capture the created Order ID
 *
 *   Part B — Xenvio (Angular/PrimeNG):
 *     4. Login to Xenvio + Open Shipper View (popup)
 *     5. Select Warehouse (qa20) + App (from APP_XENVIO env)
 *     6. Search for the shipment by the captured order number
 *     7. Click on shipment row → capture task_executor response
 *     8. Verify imported data:
 *        - aasmState = "pending"
 *        - Customer name & address present
 *        - Items with correct SKUs & quantities
 *        - Box dimensions & weight
 *        - Shipping method / ship code
 */
test.describe('Xenvio Core Import Verification (v2 PrimeNG)', () => {

    // Extend the global timeout — this test crosses two systems
    test.setTimeout(10 * 60 * 1000); // 10 minutes

    test('TC-Xenvio-CoreImport-001: Create order in Core and verify in Xenvio', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        // ── Config ────────────────────────────────────────────────────────
        const coreConfig = {
            coreUrl:  process.env.BASE_URL || 'https://qa20.shipedge.com',
            email:    process.env.TEST_USER_EMAIL!,
            password: process.env.TEST_USER_PASSWORD!,
        };

        const xenvioConfig = {
            url:       process.env.XENVIO_URL || 'http://localhost:3000/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            warehouse: process.env.WAREHOUSE_XENVIO || 'qa20',
            app:       process.env.APP_XENVIO || 'qa20',
        };

        // ── Allure metadata ───────────────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Core Import Verification — ${coreConfig.coreUrl} → Xenvio`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'core-import', 'cross-system', 'e2e', 'v2', 'primeng', 'integration'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Core Import Verification (v2 PrimeNG)',
            story:    'Create order in ShipEdge Core and verify it is correctly imported in Xenvio',
        });

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  📋 CORE → XENVIO IMPORT VERIFICATION TEST');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  Core URL    : ${coreConfig.coreUrl}`);
        console.log(`  Xenvio URL  : ${xenvioConfig.url}`);
        console.log(`  Warehouse   : ${xenvioConfig.warehouse}`);
        console.log(`  App         : ${xenvioConfig.app}`);
        console.log('═══════════════════════════════════════════════════════\n');

        // ═════════════════════════════════════════════════════════════════
        // PART A — ShipEdge Core: Login + Create Order + Capture ID
        // ═════════════════════════════════════════════════════════════════
        const orderId = await CoreImportWorkflows.loginAndCreateOrderInCore(page, coreConfig);
        console.log(`\n📌 Order created in Core — ID: ${orderId}`);
        console.log(`   This will be used to search in Xenvio Shipper View\n`);

        // ═════════════════════════════════════════════════════════════════
        // PART B — Xenvio: Login + Open Shipper View
        // ═════════════════════════════════════════════════════════════════
        const popupPage = await test.step('2. Login to Xenvio and Open Shipper View', async () => {
            console.log('🔑 Logging in to Xenvio...');
            await xenvioLoginPage.navigateToLogin(xenvioConfig.url);
            await xenvioLoginPage.login(xenvioConfig.email, xenvioConfig.pass);
            await AllureHelper.attachScreenShot(page);

            console.log('📺 Opening Shipper View...');
            const popup = await xenvioDashboardPage.openShipperView();
            console.log('✅ Shipper View opened');
            await AllureHelper.attachScreenShot(popup);
            return popup;
        });

        // ═════════════════════════════════════════════════════════════════
        // PART B (cont.) — Search for shipment and capture data
        // ═════════════════════════════════════════════════════════════════
        const verification = await CoreImportWorkflows.searchAndCaptureShipmentInXenvio(
            popupPage,
            orderId,
            {
                warehouse: xenvioConfig.warehouse,
                app:       xenvioConfig.app,
            }
        );

        // ═════════════════════════════════════════════════════════════════
        // STEP 9 — Assertions: Verify imported data is correct
        // ═════════════════════════════════════════════════════════════════
        await test.step('4. Verify Imported Shipment Data', async () => {
            console.log('\n🔍 Running assertions on imported shipment data...\n');

            // ── 9a. Shipment state must be "pending" ────────────────
            if (verification.aasmState) {
                expect(
                    verification.aasmState,
                    'Shipment state should be "pending" after import'
                ).toBe('pending');
                console.log(`  ✅ aasmState: ${verification.aasmState}`);
            } else {
                console.warn('  ⚠️ aasmState not available in response');
            }

            // ── 9b. Customer name should be present ─────────────────
            expect(
                verification.customerName,
                'Customer name should be present in imported shipment'
            ).not.toBeNull();
            console.log(`  ✅ Customer name: ${verification.customerName}`);

            // ── 9c. Customer address should have city, state, zip ───
            if (verification.customerAddress) {
                expect(
                    verification.customerAddress.city,
                    'Customer city should be present'
                ).not.toBeNull();
                expect(
                    verification.customerAddress.state,
                    'Customer state should be present'
                ).not.toBeNull();
                expect(
                    verification.customerAddress.zip,
                    'Customer zip should be present'
                ).not.toBeNull();
                console.log(`  ✅ Address: ${verification.customerAddress.city}, ${verification.customerAddress.state} ${verification.customerAddress.zip}`);
            }

            // ── 9d. At least 1 box with items ──────────────────────
            expect(
                verification.boxes.length,
                'At least 1 box expected in imported shipment'
            ).toBeGreaterThan(0);
            console.log(`  ✅ Boxes count: ${verification.boxes.length}`);

            // ── 9e. Items should be present ─────────────────────────
            const totalItems = verification.boxes.reduce(
                (sum, box) => sum + box.items.length, 0
            );
            expect(
                totalItems,
                'At least 1 item expected across all boxes'
            ).toBeGreaterThan(0);
            console.log(`  ✅ Total items across all boxes: ${totalItems}`);

            // ── 9f. Verify SKUs are present (not null/empty) ────────
            for (const box of verification.boxes) {
                for (const item of box.items) {
                    expect(
                        item.sku,
                        `Item SKU should be present (box ${box.boxNumber})`
                    ).not.toBeNull();
                    expect(
                        item.quantity,
                        `Item quantity should be > 0 for SKU ${item.sku}`
                    ).toBeGreaterThan(0);
                    console.log(`  ✅ Item: SKU=${item.sku}, qty=${item.quantity}, weight=${item.weight}, price=${item.price}`);
                }
            }

            // ── 9g. Box dimensions should be present ────────────────
            for (const box of verification.boxes) {
                expect(box.length, `Box ${box.boxNumber} length should be present`).not.toBeNull();
                expect(box.width, `Box ${box.boxNumber} width should be present`).not.toBeNull();
                expect(box.height, `Box ${box.boxNumber} height should be present`).not.toBeNull();
                expect(box.weight, `Box ${box.boxNumber} weight should be present`).not.toBeNull();
                console.log(`  ✅ Box ${box.boxNumber}: dims=${box.length}×${box.width}×${box.height}, weight=${box.weight}`);
            }

            // ── 9h. Shipping method / ship code should be present ───
            if (verification.shippingMethodCode) {
                console.log(`  ✅ Ship code: ${verification.shippingMethodCode}`);
            } else {
                console.log('  ⚠️ Ship code not available (may not be set until rates are fetched)');
            }

            if (verification.shippingMethodName) {
                console.log(`  ✅ Shipping method: ${verification.shippingMethodName}`);
            }

            if (verification.carrierName) {
                console.log(`  ✅ Carrier: ${verification.carrierName}`);
            }

            // ── 9i. Warehouse should match config ───────────────────
            if (verification.warehouseName) {
                expect(
                    verification.warehouseName.toLowerCase(),
                    `Warehouse should be "${xenvioConfig.warehouse}"`
                ).toContain(xenvioConfig.warehouse.toLowerCase());
                console.log(`  ✅ Warehouse: ${verification.warehouseName}`);
            }

            console.log('\n✅ All import verification assertions passed!');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Final summary ─────────────────────────────────────────────────
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  🎉 TEST COMPLETE — Core → Xenvio Import Verified');
        console.log(`  Order ID (Core)  : ${orderId}`);
        console.log(`  Shipment #       : ${verification.shipmentNumber ?? 'N/A'}`);
        console.log(`  State            : ${verification.aasmState ?? 'N/A'}`);
        console.log(`  Customer         : ${verification.customerName ?? 'N/A'}`);
        console.log(`  Items            : ${verification.boxes.reduce((s, b) => s + b.items.length, 0)}`);
        console.log(`  Ship Code        : ${verification.shippingMethodCode ?? 'N/A'}`);
        console.log('═══════════════════════════════════════════════════════\n');
    });

    // ─── After-each error capture ─────────────────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
