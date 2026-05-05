import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { XenvioCarrierConfigPage } from '../page-objects/xenvio-carrier-config-page';

/**
 * Xenvio Carrier Configuration Test Suite
 *
 * Tests the end-to-end flow for creating a new carrier in the
 * Shipper View → Configuration section.
 *
 * Flow:
 *   1. Login to Xenvio and open Shipper View
 *   2. Open Configuration menu → Click "Configuration"
 *   3. Select the warehouse/location
 *   4. Search and select a carrier (e.g. USPS)
 *   5. Fill carrier details (Name, Description, EZ Carrier Account, API Key)
 *   6. Save the carrier
 *   7. Verify: See carriers configured → Find carrier → View Shipping codes
 *
 * Prerequisites:
 *   - XENVIO_URL, XENVIO_EMAIL, XENVIO_PASSWORD in .env
 *   - WAREHOUSE_XENVIO in .env (e.g. "qa20")
 *   - CARRIER_EZ_ACCOUNT in .env (EZ Carrier Account ID)
 *   - CARRIER_API_KEY in .env (API Key for the carrier)
 */
test.describe('Xenvio Carrier Configuration Flow', () => {

    test('TC-Xenvio-Carrier-001: Create a new USPS carrier and verify shipping codes', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        // ─── Environment Variables ────────────────────────────────
        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        const carrierAccount = process.env.CARRIER_EZ_ACCOUNT!;
        const carrierApiKey = process.env.CARRIER_API_KEY!;

        // Validate required environment variables
        if (!carrierAccount || !carrierApiKey) {
            throw new Error('CARRIER_EZ_ACCOUNT and CARRIER_API_KEY must be set in .env');
        }

        // Generate a unique carrier name to avoid duplicates
        const carrierName = XenvioCarrierConfigPage.generateCarrierName('USPS');
        const carrierDescription = `Automated test carrier - ${new Date().toISOString().slice(0, 10)}`;

        // ─── Allure Metadata ─────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Create USPS Carrier — ${carrierName}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "carrier", "configuration", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Carrier Configuration",
            story: "Create a new USPS carrier with shipping codes",
            parentSuite: "Xenvio Configuration Suite",
            suite: "Carrier Tests",
            subSuite: "Carrier Creation"
        });

        console.log(`\n🚚 Carrier Configuration Test`);
        console.log(`   Name: ${carrierName}`);
        console.log(`   Warehouse: ${config.warehouse}`);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login and Open Shipper View
        // ═══════════════════════════════════════════════════════════

        let popupPage = await allure.step('1. Login and Open Shipper View', async () => {
            await xenvioLoginPage.navigateToLogin(config.url);
            await xenvioLoginPage.login(config.email, config.pass);
            const popup = await xenvioDashboardPage.openShipperView();
            console.log('✅ Logged in and Shipper View opened');
            await AllureHelper.attachScreenShot(popup);
            return popup;
        });

        // Create the Carrier Config page object on the popup page
        const carrierConfigPage = new XenvioCarrierConfigPage(popupPage);

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Navigate to Configuration
        // ═══════════════════════════════════════════════════════════

        await allure.step('2. Open Configuration Menu', async () => {
            await carrierConfigPage.clickConfigMenuButton();
            await carrierConfigPage.clickConfigurationMenuItem();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Select Location (Warehouse)
        // ═══════════════════════════════════════════════════════════

        await allure.step('3. Select Location/Warehouse', async () => {
            await carrierConfigPage.selectLocation(config.warehouse);
            console.log(`✅ Location selected: ${config.warehouse}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Search and Select Carrier
        // ═══════════════════════════════════════════════════════════

        await allure.step('4. Search and Select USPS Carrier', async () => {
            await carrierConfigPage.searchCarrier('usps');
            await carrierConfigPage.selectCarrier('USPS');
            console.log('✅ USPS carrier selected');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Fill Carrier Details
        // ═══════════════════════════════════════════════════════════

        await allure.step('5. Fill Carrier Configuration Details', async () => {
            await carrierConfigPage.fillCarrierForm({
                name: carrierName,
                description: carrierDescription,
                ezCarrierAccount: carrierAccount,
                apiKey: carrierApiKey
            });
            console.log('✅ Carrier form filled');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Save Carrier
        // ═══════════════════════════════════════════════════════════

        await allure.step('6. Save Carrier', async () => {
            await carrierConfigPage.clickSave();
            console.log('✅ Carrier saved');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Verify — See Carriers Configured
        // ═══════════════════════════════════════════════════════════

        await allure.step('7. Verify Carrier in Configured List', async () => {
            await carrierConfigPage.clickSeeCarriersConfigured();

            // Find and click the created carrier
            const isCarrierVisible = await carrierConfigPage.isCarrierVisibleInList(carrierName);
            expect(isCarrierVisible).toBe(true);
            console.log(`✅ Carrier "${carrierName}" found in configured list`);

            await carrierConfigPage.clickConfiguredCarrier(carrierName);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 8: Verify — View Shipping Codes
        // ═══════════════════════════════════════════════════════════

        await allure.step('8. Verify Shipping Codes', async () => {
            await carrierConfigPage.clickShippingCodes();
            console.log('✅ Shipping codes verified — carrier creation complete');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 9: Navigate Back to Carriers List (Final Evidence)
        // ═══════════════════════════════════════════════════════════

        await allure.step('9. Navigate Back to Carriers List', async () => {
            await carrierConfigPage.navigateToCarriersConfiguredList();
            console.log('✅ Navigated back to Carriers configured list');
            await AllureHelper.attachScreenShot(popupPage);
        });

        console.log(`\n🎉 Carrier Configuration Test PASSED! Carrier: ${carrierName}`);
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
