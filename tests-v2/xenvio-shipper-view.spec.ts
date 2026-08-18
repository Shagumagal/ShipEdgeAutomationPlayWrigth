import { Page } from '@playwright/test';
import { test, expect } from '../lib-v2/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../lib/allure-helper';
import { XenvioShipperViewPage } from '../page-objects-v2/xenvio-shipper-view-page';

/**
 * ─── Xenvio Shipper View Smoke Test (v2 — PrimeNG) ─────────────────────────
 *
 * Verifies:
 *   1. Login to Xenvio
 *   2. Open Shipper View (new tab)
 *   3. Select Warehouse & Application via p-select
 *   4. Search for an existing shipment
 */
test.describe('Xenvio Shipper View Smoke (v2 PrimeNG)', () => {

    test('TC-Xenvio-ShipperView: Verify login and Shipper View form', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: 'Xenvio Login & Shipper View v2',
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'smoke', 'shipperview', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Shipper View (v2 PrimeNG)',
            story:    'Verify login and Shipper View form loads correctly',
        });

        const xenvioUrl      = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
        const xenvioEmail    = process.env.XENVIO_EMAIL!;
        const xenvioPassword = process.env.XENVIO_PASSWORD!;
        const appName        = process.env.APP_XENVIO!;
        const warehouseName  = process.env.WAREHOUSE_XENVIO!;
        const idShip         = process.env.ID_SHIP;

        if (!xenvioEmail || !xenvioPassword || !appName || !warehouseName) {
            throw new Error('XENVIO_EMAIL, XENVIO_PASSWORD, APP_XENVIO, and WAREHOUSE_XENVIO must be set in .env');
        }

        let popupPage: Page;

        // ── Step 1: Login ──
        await allure.step('1. Navigate to Xenvio Login', async () => {
            console.log(`Navegando a: ${xenvioUrl}`);
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
        });

        await allure.step('2. Perform Login in Xenvio', async () => {
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            console.log('✅ Login exitoso en Xenvio');
        });

        // ── Step 2: Open Shipper View ──
        await allure.step('3. Go to Shipper View (opens in new tab)', async () => {
            popupPage = await xenvioDashboardPage.openShipperView();
            console.log(`Pestaña nueva abierta. URL actual: ${popupPage.url()}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

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
