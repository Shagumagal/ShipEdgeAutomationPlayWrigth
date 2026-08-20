import { test, expect } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { XenvioCreateAppPage } from '../page-objects/xenvio-create-app-page';

/**
 * Xenvio Shipper View – Create App Test Suite (v2 — PrimeNG / Angular)
 *
 * Tests the end-to-end flow for creating a new App via the header menu.
 *
 * Flow:
 *   1. Login → Shipper View
 *   2. Configuration gear → "Apps"
 *   3. Click "New app" → Modal opens
 *   4. Fill App Name (e.g. "qa20-app-14h23")
 *   5. Check warehouse checkbox (e.g. "qa20")
 *   6. Fill URL: https://{warehouse}.shipedge.com/apirest/webhooks/xenvio/shipments
 *   7. Click "Create App"
 *   8. Intercept API response for evidence
 *   9. Filter table by name → Verify app appears
 *
 * Prerequisites (in .env):
 *   - XENVIO_URL, XENVIO_EMAIL, XENVIO_PASSWORD
 *   - WAREHOUSE_XENVIO (e.g. "qa20")
 */
test.describe('Xenvio Create App (v2 PrimeNG)', () => {

    test('TC-Xenvio-CreateApp-001: Create a new App with webhook URL and verify in table', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }, testInfo) => {

        // ─── Environment Variables ────────────────────────────────
        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        const appName = XenvioCreateAppPage.generateAppName(config.warehouse);
        const webhookUrl = XenvioCreateAppPage.buildWebhookUrl(config.warehouse);

        // ─── Allure Metadata ─────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Create App — ${appName}`,
            owner: 'QA Automation Team',
            tags: ['xenvio', 'create-app', 'shipper-view', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic: 'Xenvio',
            feature: 'App Management (v2 PrimeNG)',
            story: 'Create a new App with webhook URL',
            parentSuite: 'Xenvio Configuration Suite',
            suite: 'App Management Tests',
            subSuite: 'App Creation',
            url: config.url,
            environment: process.env.ENV_NAME || 'QA',
        });

        console.log(`\n📱 Create App Test (v2)`);
        console.log(`   App Name  : ${appName}`);
        console.log(`   Warehouse : ${config.warehouse}`);
        console.log(`   URL       : ${webhookUrl}`);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login and Open Shipper View
        // ═══════════════════════════════════════════════════════════

        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage, xenvioDashboardPage, config
        );

        const createAppPage = new XenvioCreateAppPage(popupPage);

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Navigate to Apps
        // ═══════════════════════════════════════════════════════════

        await allure.step('2. Navigate to Apps', async () => {
            await createAppPage.navigateToApps();
            console.log('✅ Apps page loaded');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Click New App
        // ═══════════════════════════════════════════════════════════

        await allure.step('3. Open New App Modal', async () => {
            await createAppPage.clickNewApp();
            const modalVisible = await createAppPage.isNewAppModalVisible();
            expect(modalVisible, 'New App modal must be visible').toBe(true);
            console.log('✅ New App modal is open');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Fill App Name
        // ═══════════════════════════════════════════════════════════

        await allure.step('4. Fill App Name', async () => {
            await createAppPage.fillAppName(appName);
            await allure.attachment('App Name', appName, 'text/plain');
            console.log(`✅ App Name filled: ${appName}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Select Warehouse Checkbox
        // ═══════════════════════════════════════════════════════════

        await allure.step('5. Select Warehouse Facility', async () => {
            await createAppPage.selectWarehouseCheckbox(config.warehouse);
            console.log(`✅ Warehouse "${config.warehouse}" selected`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Fill Webhook URL
        // ═══════════════════════════════════════════════════════════

        await allure.step('6. Fill Webhook URL', async () => {
            await createAppPage.fillWarehouseUrl(config.warehouse, webhookUrl);
            await allure.attachment('Webhook URL', webhookUrl, 'text/plain');
            console.log(`✅ Webhook URL filled: ${webhookUrl}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Click Create App + Intercept API
        // ═══════════════════════════════════════════════════════════

        await allure.step('7. Create App and capture API response', async () => {
            // Set up fetch interceptor to capture the create app API response
            await popupPage.evaluate(() => {
                const origFetch = window.fetch;
                (window as any).__capturedCreateApp = null;
                window.fetch = async function (...args: any[]) {
                    const response = await origFetch.apply(this, args as any);
                    try {
                        const url = (args[0] instanceof Request ? args[0].url : String(args[0])) || '';
                        if (url.includes('apps') && response.ok) {
                            const clone = response.clone();
                            const body = await clone.json();
                            (window as any).__capturedCreateApp = body;
                        }
                    } catch { /* ignore */ }
                    return response;
                };
            });

            await createAppPage.clickCreateApp();

            // Retrieve captured API response
            const apiResponse = await popupPage.evaluate(() => (window as any).__capturedCreateApp);

            if (apiResponse) {
                console.log('📡 API response captured:');
                console.log(JSON.stringify(apiResponse, null, 2).substring(0, 500));
                await AllureHelper.attachJSON(popupPage, 'Create App API Response', apiResponse);
            } else {
                console.log('⚠ Could not capture API response (non-critical)');
            }

            // Cleanup interceptor
            await popupPage.evaluate(() => {
                delete (window as any).__capturedCreateApp;
            }).catch(() => { /* page might be closed */ });

            console.log('✅ App creation submitted');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 8: Verify App in Table
        // ═══════════════════════════════════════════════════════════

        await allure.step('8. Verify App appears in the table', async () => {
            const isVisible = await createAppPage.filterAndVerifyApp(appName);

            expect(isVisible, `App "${appName}" must be visible in the apps table after creation`).toBe(true);
            console.log(`✅ App "${appName}" verified in table`);

            // Final screenshot as evidence
            await popupPage.waitForTimeout(1000);
            await AllureHelper.attachScreenShot(popupPage);
            console.log('📸 Final screenshot captured');
        });

        console.log(`\n🎉 Create App Test PASSED!`);
        console.log(`   App: ${appName}`);
        console.log(`   URL: ${webhookUrl}`);
    });
});
