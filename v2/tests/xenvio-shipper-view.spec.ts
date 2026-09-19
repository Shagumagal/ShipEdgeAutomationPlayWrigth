import { test } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
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
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Shipper View (v2 PrimeNG)',
            story:    'Verify login and Shipper View form loads correctly',
        });

        const { app: appName, warehouse: warehouseName } = xenvio.config;
        const idShip         = process.env.ID_SHIP;

        const session = await xenvio.openSession();
        const popupPage = session.page;
        console.log(`Pestaña nueva abierta. URL actual: ${popupPage.url()}`);
        await AllureHelper.attachScreenShot(popupPage);

        // ── Step 3: Select Warehouse & App ──
        await allure.step('4. Fill Warehouse and Application dropdowns', async () => {
            const shipperViewPage = new XenvioShipperViewPage(popupPage);
            await shipperViewPage.selectWarehouse(warehouseName);
            await shipperViewPage.selectApplication(appName);
            console.log('✅ Dropdowns seleccionados correctamente');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 4: Search for Shipment (if ID_SHIP is set) ──
        if (idShip) {
            await allure.step('5. Search for Shipment by ID', async () => {
                const shipperViewPage = new XenvioShipperViewPage(popupPage);
                await shipperViewPage.searchShipment(idShip);
                console.log(`✅ Búsqueda completada para el Order ID: ${idShip}`);
                await AllureHelper.attachScreenShot(popupPage);
            });
        } else {
            console.log('ℹ️ ID_SHIP not set — skipping shipment search step');
        }
    });
});
