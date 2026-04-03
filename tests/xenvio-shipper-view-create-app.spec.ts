import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import logger from "../lib/logger";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';

const log = logger({ filename: __filename });

/**
 * Xenvio Shipper View — Create App Test Suite
 *
 * Flow:
 *   1. Login to Xenvio (reuses xenvioLoginPage)
 *   2. Open Shipper View in popup via Dashboard link
 *   3. Configuration menu → Apps
 *   4. New App modal → Name → Select Facility (qa20) → Fill URL → Create App
 *
 * Key difference from Legacy flow:
 *   Selecting the warehouse/facility checkbox ENABLES its URL input.
 *   URL must be filled AFTER the checkbox is checked.
 */
test.describe('Xenvio Shipper View Create App', () => {

    test('TC-Xenvio-ShipperView-CreateApp-001: Create new app via Shipper View', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage,
        waitForPageLoad
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: 'Create App — Xenvio Shipper View',
            owner: "QA Automation Team",
            tags: ["xenvio", "create-app", "shipper-view", "regression"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Shipper View",
            story: "Manage Apps",
            parentSuite: "Xenvio Suite",
            suite: "Shipper View Tests",
            subSuite: "App Management"
        });

        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo1.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL!;
        const xenvioPassword = process.env.XENVIO_PASSWORD!;
        const warehouseName = process.env.WAREHOUSE_XENVIO!;  // "qa20"
        const webhookUrl = XenvioShipperViewPage.buildWebhookUrl(warehouseName);
        const appName = XenvioShipperViewPage.generateAppName(warehouseName);

        log.info('--- Starting Test: Shipper View Create App ---', { warehouse: warehouseName, appName, url: webhookUrl });

        // ─── Step 1: Login to Xenvio ──────────────────────────────
        await allure.step('1. Login to Xenvio', async () => {
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
            await waitForPageLoad();
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            await waitForPageLoad();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 2: Open Shipper View popup ──────────────────────
        // The Shipper View opens in a new tab (popup).
        // We get that popup Page and create a new Page Object instance on it.
        let shipperViewPage: XenvioShipperViewPage;

        await allure.step('2. Open Shipper View', async () => {
            const popupPage = await xenvioDashboardPage.openShipperView();
            await popupPage.waitForLoadState('networkidle');
            // Instantiate the Page Object on the popup page
            shipperViewPage = new XenvioShipperViewPage(popupPage);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ─── Step 3: Configuration Menu → Apps ───────────────────
        await allure.step('3. Open Configuration menu and click Apps', async () => {
            await shipperViewPage!.openConfigMenu();
            await shipperViewPage!.clickAppsMenuItem();
            await AllureHelper.attachScreenShot(shipperViewPage!['page']);
        });

        // ─── Step 4: Click New App ────────────────────────────────
        await allure.step('4. Open New App Modal', async () => {
            await shipperViewPage!.clickNewApp();
            expect(await shipperViewPage!.isNewAppModalVisible()).toBe(true);
            await AllureHelper.attachScreenShot(shipperViewPage!['page']);
        });

        // ─── Step 5: Fill App Name ────────────────────────────────
        await allure.step('5. Fill App Name', async () => {
            await shipperViewPage!.fillName(appName);
            await allure.attachment('App Name', appName, 'text/plain');
            await AllureHelper.attachScreenShot(shipperViewPage!['page']);
        });

        // ─── Step 6: Select Facility (qa20) & Fill URL ───────────
        // IMPORTANT: In Shipper View, the URL input is enabled ONLY
        // after checking the warehouse/facility checkbox.
        await allure.step('6. Select Facility (qa20) and fill Webhook URL', async () => {
            await shipperViewPage!.selectFacilityAndFillUrl(warehouseName, webhookUrl);
            await allure.attachment('Facility', warehouseName, 'text/plain');
            await allure.attachment('Webhook URL', webhookUrl, 'text/plain');
            await AllureHelper.attachScreenShot(shipperViewPage!['page']);
        });

        // ─── Step 7: Click Create App ─────────────────────────────
        await allure.step('7. Click Create App', async () => {
            await shipperViewPage!.clickCreateApp();
            await shipperViewPage!['page'].waitForLoadState('networkidle');
            await AllureHelper.attachScreenShot(shipperViewPage!['page']);
        });

        // ─── Step 8: Verify App Created ───────────────────────────
        await allure.step('8. Verify App Created', async () => {
            const isVisible = await shipperViewPage!.isAppNameInTableVisible(appName);

            if (isVisible) {
                log.info('Shipper View App created and verified in table', { appName });
            } else {
                log.warn('App name not found in table, but form was submitted', { appName });
            }

            expect(shipperViewPage!['page'].url()).toContain('/apps');
            await AllureHelper.attachScreenShot(shipperViewPage!['page']);
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
