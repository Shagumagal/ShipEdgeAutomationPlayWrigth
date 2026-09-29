import { test } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';

/**
 * ─── Xenvio Shipper View Smoke Test (v2 — PrimeNG) ─────────────────────────
 *
 * Verifies:
 *   1. Login to Xenvio
 *   2. Open Shipper View (new tab)
 *   3. Select Warehouse & Application via p-select
 *   4. Search for an existing shipment
 */
test.describe('Xenvio Shipper View Smoke (v2 PrimeNG)', { tag: ['@smoke', '@session'] }, () => {

    test('TC-Xenvio-ShipperView: Verify login and Shipper View form', async ({
        xenvio,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: 'Xenvio Login & Shipper View v2',
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'smoke', 'shipperview', 'session', 'v2', 'primeng'],
            severity: 'normal',
            epic:     'Xenvio',
            feature:  'Shipper View (v2 PrimeNG)',
            story:    'Verify login and Shipper View form loads correctly',
        });

        const { app: appName, warehouse: warehouseName } = xenvio.config;
        const idShip         = process.env.ID_SHIP;

        const session = await xenvio.openSession();
        const popupPage = session.page;
        console.log(`New tab opened. Current URL: ${popupPage.url()}`);
        await AllureHelper.attachScreenShot(popupPage, 'Shipper View open');

        // ── Select Warehouse & App ──
        await allure.step('Fill Warehouse and Application dropdowns', async () => {
            const shipperViewPage = new XenvioShipperViewPage(popupPage);
            await shipperViewPage.selectWarehouse(warehouseName);
            await shipperViewPage.selectApplication(appName);
            await AllureHelper.attachScreenShot(popupPage, 'Fill Warehouse and Application dropdowns');
        });

        // ── Search for Shipment (if ID_SHIP is set) ──
        if (idShip) {
            await allure.step('Search for Shipment by ID', async () => {
                const shipperViewPage = new XenvioShipperViewPage(popupPage);
                await shipperViewPage.searchShipment(idShip);
                console.log(`✅ Search completed for Order ID: ${idShip}`);
                await AllureHelper.attachScreenShot(popupPage, 'Search for Shipment by ID');
            });
        } else {
            console.log('ℹ️ ID_SHIP not set — skipping shipment search step');
        }
    });
});
