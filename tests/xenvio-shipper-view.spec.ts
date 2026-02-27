import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Standalone Xenvio Flow Test
 */
test.describe('Xenvio Standalone Flow', () => {

    test('TC-Xenvio-Login: Verify Xenvio login and dashboard access', async ({
        page,
        xenvioLoginPage,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Xenvio Standalone Login",
            owner: "QA Automation Team",
            tags: ["xenvio", "smoke"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Login",
            story: "Standalone Login"
        });

        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL;
        const xenvioPassword = process.env.XENVIO_PASSWORD;

        if (!xenvioEmail || !xenvioPassword) {
            throw new Error('XENVIO_EMAIL and XENVIO_PASSWORD must be set in .env');
        }

        await allure.step('1. Navigate to Xenvio Login', async () => {
            console.log(`Navegando a: ${xenvioUrl}`);
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
        });

        await allure.step('2. Perform Login in Xenvio', async () => {
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            console.log('Login intentado');
        });

        await allure.step('3. Verify successful login/Dashboard', async () => {
            // Aquí agregamos verificaciones de que el login fue exitoso
            // Por ejemplo, que la URL cambió o que aparece un elemento del dashboard
            await page.waitForTimeout(3000);
            console.log(`Current URL after login: ${page.url()}`);
            await AllureHelper.attachScreenShot(page);
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
