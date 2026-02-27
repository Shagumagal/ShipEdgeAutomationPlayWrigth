import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Shipedge -> Xenvio Flow Test Suite
 * 
 * Flujo completo: Login ShipEdge -> Crear Orden -> Capturar Order ID -> Login Xenvio
 * (La parte de Xenvio está preparada para empezar a desarrollarse con nuevas credentials)
 */
test.describe('Shipedge to Xenvio E2E Flow', () => {

    test.beforeEach(async ({ shipedgeLoginPage, shipedgeOrdersPage }) => {
        // 1. Login en ShipEdge
        await shipedgeLoginPage.navigateToLogin();

        const email = process.env.TEST_USER_EMAIL;
        const password = process.env.TEST_USER_PASSWORD;

        if (!email || !password) {
            throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env');
        }

        await shipedgeLoginPage.login(email, password);
        await shipedgeLoginPage.waitForSuccessfulLogin();

        // 2. Handle "Remind Me Later" popup that appears right after login
        await shipedgeOrdersPage.handleRemindMeLaterPopup();
    });

    test('TC-Xenvio-001: Create order in ShipEdge and find it in Xenvio', async ({
        page,
        shipedgeOrdersPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "ShipEdge Order to Xenvio Sync",
            owner: "QA Automation Team",
            tags: ["orders", "xenvio", "e2e"],
            severity: "critical",
            epic: "Integration",
            feature: "Order Sync",
            story: "Create order in ShipEdge and find in Xenvio"
        });

        // ---------------------------------------------
        // PARTE 1: SHIPEDGE (CREAR LA ORDEN)
        // ---------------------------------------------
        await allure.step('1. Start Create Order Flow in ShipEdge', async () => {
            // Start the flow
            await shipedgeOrdersPage.startCreateOrderFlow();
        });

        await allure.step('2. Verify Order Saved', async () => {
            // Wait for the creation process to finish
            await shipedgeOrdersPage.waitForOrderCreated(20000);
            console.log(`Current state verified. URL: ${page.url()}`);

            // Assertion: Verify we are no longer on the 'new order' blank form
            await expect(page).not.toHaveURL(/typeorder=regular/);
        });

        let capturedOrderId: string | null = null;

        await allure.step('3. Capture Created Order ID', async () => {
            capturedOrderId = await shipedgeOrdersPage.getCreatedOrderId();

            if (capturedOrderId) {
                console.log(`🎉 ShipEdge Order created successfully! Order ID: ${capturedOrderId}`);
                await allure.attachment('Created Order ID', capturedOrderId, 'text/plain');
            } else {
                throw new Error('⚠️ Could not capture the Order ID from ShipEdge.');
            }

            await AllureHelper.attachScreenShot(page);
        });

        // ---------------------------------------------
        // PARTE 2: XENVIO (LOGIN Y BUSCAR ORDEN)
        // ---------------------------------------------
        await allure.step('4. Login to Xenvio', async () => {
            const xenvioUrl = process.env.XENVIO_URL;
            const xenvioEmail = process.env.XENVIO_EMAIL;
            const xenvioPassword = process.env.XENVIO_PASSWORD;

            if (!xenvioUrl || !xenvioEmail || !xenvioPassword) {
                throw new Error('XENVIO_URL, XENVIO_EMAIL, and XENVIO_PASSWORD must be set in .env');
            }

            console.log(`Navegando a Xenvio URL: ${xenvioUrl}`);
            await page.goto(xenvioUrl);
            await page.waitForLoadState('networkidle');

            // Aquí iremos construyendo el Page Object y el flujo de login de Xenvio.
            // Por ahora, solo abrimos la URL e imprimimos el Order ID capturado.
            console.log(`✅ Listo para buscar el Order ID en Xenvio: ${capturedOrderId}`);
            await AllureHelper.attachScreenShot(page);

            // TODO: Agregar interacción con login de Xenvio...
            // Ej: await page.locator('#email').fill(xenvioEmail);
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
