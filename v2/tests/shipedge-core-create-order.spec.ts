import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from "../evidence/allure-helper";
import { CoreImportWorkflows } from '../workflows/core-import-workflow';

/**
 * ─── ShipEdge Core — Create Order ───────────────────────────────────────────
 *
 * Test: TC-Core-CreateOrder-001 — Create an order in ShipEdge Core and capture its Order ID.
 *
 * Core only (no Xenvio). The import into Xenvio is covered by xenvio-core-import-verify.spec.ts.
 *
 * Flow:
 *  1. Login to ShipEdge Core (BASE_URL)
 *  2. Create a new order (Address Book → Products with stock → Shipping → Save)
 *  3. Verify the order was saved and capture its Order ID
 */
test.describe('ShipEdge Core Create Order', { tag: ['@orders', '@core'] }, () => {

    // Needs a ShipEdge Core environment (BASE_URL). Same switch as the core-import test.
    test.skip(
        process.env.RUN_CORE_TESTS?.trim().toLowerCase() !== 'true',
        'ShipEdge Core is not available: set BASE_URL and RUN_CORE_TESTS=true to run it',
    );

    test('TC-Core-CreateOrder-001: Create order in ShipEdge Core', async ({ page }) => {
        const coreConfig = {
            coreUrl:  process.env.BASE_URL || 'https://qa20.shipedge.com',
            email:    process.env.TEST_USER_EMAIL!,
            password: process.env.TEST_USER_PASSWORD!,
        };

        await AllureHelper.applyTestMetadata({
            displayName: `Create Order in ShipEdge Core — ${coreConfig.coreUrl}`,
            owner:    'QA Automation Team',
            tags:     ['core', 'orders', 'shipedge', 'v2'],
            severity: 'critical',
            epic:     'ShipEdge Core',
            feature:  'Orders',
            story:    'Create an order in ShipEdge Core',
        });

        await AllureHelper.addRunParameters({ 'Core URL': coreConfig.coreUrl });

        const orderId = await CoreImportWorkflows.loginAndCreateOrderInCore(page, coreConfig);

        expect(orderId, 'Core must return the created Order ID').toBeTruthy();
        console.log(`📌 Order created in Core — ID: ${orderId}`);
    });
});
