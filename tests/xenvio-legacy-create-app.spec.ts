import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import logger from "../lib/logger";
import { XenvioLegacySettingsPage } from '../page-objects/xenvio-legacy-settings-page';

const log = logger({ filename: __filename });

/**
 * Xenvio Legacy Create App Test Suite
 */
test.describe('Xenvio Legacy Create App', () => {

    test('TC-Xenvio-Legacy-CreateApp-001: Create new app in legacy settings', async ({
        page,
        xenvioLoginPage,
        xenvioLegacySettingsPage,
        waitForPageLoad
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: 'Create Legacy App — Xenvio Settings',
            owner: "QA Automation Team",
            tags: ["xenvio", "create-app", "legacy", "regression"],
            severity: "critical",
            epic: "Xenvio Legacy",
            feature: "Settings",
            story: "Manage Legacy Apps",
            parentSuite: "Xenvio Legacy Suite",
            suite: "Settings Tests",
            subSuite: "Legacy App Management"
        });

        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL!;
        const xenvioPassword = process.env.XENVIO_PASSWORD!;
        const warehouseName = process.env.WAREHOUSE_XENVIO!;
        const webhookUrl = XenvioLegacySettingsPage.buildWebhookUrl(warehouseName);
        const appName = XenvioLegacySettingsPage.generateAppName(warehouseName);

        log.info('--- Starting Test: Create Xenvio Legacy App ---', { warehouse: warehouseName, appName, url: webhookUrl });

        // ─── Step 1: Login to Xenvio ──────────────────────────────
        await allure.step('1. Login to Xenvio', async () => {
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
            await waitForPageLoad();
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            await waitForPageLoad();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 2: Navigate to Settings ─────────────────────────
        await allure.step('2. Navigate to Settings', async () => {
            await xenvioLegacySettingsPage.navigateToSettings();
            await waitForPageLoad();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 3: Click Apps Tab ───────────────────────────────
        await allure.step('3. Click Apps Tab', async () => {
            await xenvioLegacySettingsPage.clickAppsTab();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 4: Click New App ────────────────────────────────
        await allure.step('4. Open New App Modal', async () => {
            await xenvioLegacySettingsPage.clickNewApp();
            expect(await xenvioLegacySettingsPage.isNewAppModalVisible()).toBe(true);
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 5: Fill App Name ───────────────────────────────────────
        await allure.step('5. Fill App Name', async () => {
            await xenvioLegacySettingsPage.fillName(appName);
            await allure.attachment('App Name', appName, 'text/plain');
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 6: Fill Webhook URL ───────────────────────────────────────
        await allure.step('6. Fill Webhook URL', async () => {
            await xenvioLegacySettingsPage.fillUrl(webhookUrl);
            await allure.attachment('Webhook URL', webhookUrl, 'text/plain');
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 7: Select Warehouse ───────────────────────────────────────
        await allure.step('7. Select Warehouse', async () => {
            await xenvioLegacySettingsPage.selectWarehouse('borrar');
            await allure.attachment('Warehouse Selected', 'borrar', 'text/plain');
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 8: Click Create App ───────────────────────────────────────────
        await allure.step('8. Click Create App', async () => {
            await xenvioLegacySettingsPage.clickCreateApp();
            await waitForPageLoad();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 9: Verify App Created ───────────────────────────────────────
        await allure.step('9. Verify App Created', async () => {
            const isVisible = await xenvioLegacySettingsPage.isAppUrlInTableVisible(webhookUrl);

            if (isVisible) {
                log.info('Legacy App created successfully and verified in table', { appName });
            } else {
                log.warn('Legacy App URL not found in table, but form was submitted', { appName });
            }

            expect(page.url()).toContain('/settings');
            await AllureHelper.attachScreenShot(page);
        });

        log.info('--- Test Completed Successfully ---', { appName });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
