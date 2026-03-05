import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';

/**
 * Standalone Xenvio Flow Test
 */
test.describe('Xenvio Standalone Flow', () => {

    test('TC-Xenvio-ShipperView: Verify Xenvio login and Shipper View form', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Xenvio Login & Shipper View",
            owner: "QA Automation Team",
            tags: ["xenvio", "smoke", "shipperview"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Shipper View",
            story: "Fill Shipper View Form"
        });

        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL;
        const xenvioPassword = process.env.XENVIO_PASSWORD;
        const appName = process.env.APP_XENVIO;
        const warehouseName = process.env.WAREHOUSE_XENVIO;
        const idShip = process.env.ID_SHIP;

        if (!xenvioEmail || !xenvioPassword || !appName || !warehouseName || !idShip) {
            throw new Error('XENVIO_EMAIL, XENVIO_PASSWORD, APP_XENVIO, WAREHOUSE_XENVIO and ID_SHIP must be set in .env');
        }

        await allure.step('1. Navigate to Xenvio Login', async () => {
            console.log(`Navegando a: ${xenvioUrl}`);
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
        });

        await allure.step('2. Perform Login in Xenvio', async () => {
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            console.log('Login exitoso en Xenvio');
        });

        let popupPage: Page;

        await allure.step('3. Go to Shipper View (opens in new tab)', async () => {
            // openShipperView devuelve la nueva pestaña generada por Playwright
            popupPage = await xenvioDashboardPage.openShipperView();
            console.log(`Pestaña nueva abierta. URL actual: ${popupPage.url()}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('4. Fill Warehouse and Application dropdowns', async () => {
            // Creamos el Page Object de Shipper View instanciándolo con la PESTAÑA NUEVA
            const shipperViewPage = new XenvioShipperViewPage(popupPage);

            // Sleccionamos el Warehouse
            await shipperViewPage.selectWarehouse(warehouseName);

            // Seleccionamos la Application
            await shipperViewPage.selectApplication(appName);

            // Tomamos screenshot de cómo quedaron los campos seleccionados
            console.log('Dropdowns seleccionados correctamente.');
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('5. Search for Shipment by ID', async () => {
            const shipperViewPage = new XenvioShipperViewPage(popupPage);

            // Buscamos el Shipment
            await shipperViewPage.searchShipment(idShip);

            // Screenshot posterior a la búsqueda
            console.log(`Búsqueda completada para el Order ID: ${idShip}`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    // After hook for capturing test failure artifacts
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
