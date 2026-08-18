import { test, expect } from '../lib-v2/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../lib/allure-helper';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';
import { XenvioCarrierConfigPage } from '../page-objects-v2/xenvio-carrier-config-page';

/**
 * Xenvio Carrier Configuration Test Suite (v2 — PrimeNG / Angular)
 *
 * Tests the end-to-end flow for creating a new carrier in the
 * Shipper View → Configuration → Carriers section.
 *
 * Flow:
 *   1. Login to Xenvio and open Shipper View
 *   2. Click Configuration gear icon → p-popover → "Configuration"
 *   3. Select the warehouse/facility (mat-card list)
 *   4. Click "Carriers" step in sidebar
 *   5. Search and select a carrier (e.g. USPS)
 *   6. Fill carrier details: Name, Description + dynamic credential fields
 *   7. Save the carrier
 *   8. Verify: "See carriers configured" → find carrier → "Shipping codes"
 *
 * Prerequisites (in .env):
 *   - XENVIO_URL, XENVIO_EMAIL, XENVIO_PASSWORD
 *   - WAREHOUSE_XENVIO (e.g. "qa20")
 *   - CARRIER_EZ_ACCOUNT (EZ Carrier Account ID)
 *   - CARRIER_API_KEY (API Key for the carrier)
 */
test.describe('Xenvio Carrier Configuration (v2 PrimeNG)', () => {

    test('TC-Xenvio-Carrier-001: Create a new USPS carrier and verify shipping codes', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        // ─── Environment Variables ────────────────────────────────
        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
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
            owner: 'QA Automation Team',
            tags: ['xenvio', 'carrier', 'configuration', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic: 'Xenvio',
            feature: 'Carrier Configuration (v2 PrimeNG)',
            story: 'Create a new USPS carrier with shipping codes',
            parentSuite: 'Xenvio Configuration Suite',
            suite: 'Carrier Tests',
            subSuite: 'Carrier Creation',
            url: config.url,
            environment: process.env.ENV_NAME || 'QA',
        });

        console.log(`\n🚚 Carrier Configuration Test (v2)`);
        console.log(`   Name: ${carrierName}`);
        console.log(`   Warehouse: ${config.warehouse}`);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login and Open Shipper View
        // ═══════════════════════════════════════════════════════════

        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage, xenvioDashboardPage, config
        );

        // Create the v2 Carrier Config page object on the popup page
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
        // STEP 3: Select Location (Warehouse/Facility)
        // ═══════════════════════════════════════════════════════════

        await allure.step('3. Select Location/Warehouse', async () => {
            await carrierConfigPage.selectLocation(config.warehouse);
            console.log(`✅ Location selected: ${config.warehouse}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Navigate to Carriers step
        // ═══════════════════════════════════════════════════════════

        await allure.step('4. Navigate to Carriers Step', async () => {
            await carrierConfigPage.clickCarriersStep();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Search and Select Carrier
        // ═══════════════════════════════════════════════════════════

        await allure.step('5. Search and Select USPS Carrier', async () => {
            await carrierConfigPage.searchCarrier('usps');
            await carrierConfigPage.selectCarrier('USPS');
            console.log('✅ USPS carrier selected');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Fill Carrier Details
        // ═══════════════════════════════════════════════════════════

        await allure.step('6. Fill Carrier Configuration Details', async () => {
            await carrierConfigPage.fillCarrierForm({
                name: carrierName,
                description: carrierDescription,
                dynamicFields: [
                    { label: 'EZ Carrier Account', value: carrierAccount },
                    { label: 'API Key', value: carrierApiKey },
                ],
            });
            console.log('✅ Carrier form filled');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Save Carrier
        // ═══════════════════════════════════════════════════════════

        await allure.step('7. Save Carrier', async () => {
            await carrierConfigPage.clickSave();
            console.log('✅ Carrier saved');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 8: Verify — See Carriers Configured
        // ═══════════════════════════════════════════════════════════

        await allure.step('8. Verify Carrier in Configured List', async () => {
            await carrierConfigPage.clickSeeCarriersConfigured();

            // Find and click the created carrier
            const isCarrierVisible = await carrierConfigPage.isCarrierVisibleInList(carrierName);
            expect(isCarrierVisible).toBe(true);
            console.log(`✅ Carrier "${carrierName}" found in configured list`);

            await carrierConfigPage.clickConfiguredCarrier(carrierName);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 9: Verify — View Shipping Codes
        // ═══════════════════════════════════════════════════════════

        await allure.step('9. Verify Shipping Codes', async () => {
            await carrierConfigPage.clickShippingCodes();
            console.log('✅ Shipping codes verified — carrier creation complete');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 10: Navigate Back (Final Evidence)
        // ═══════════════════════════════════════════════════════════

        await allure.step('10. Navigate Back to Carriers List', async () => {
            await carrierConfigPage.navigateBackToCarriersList();
            console.log('✅ Navigated back to Carriers list');
            await AllureHelper.attachScreenShot(popupPage);
        });

        console.log(`\n🎉 Carrier Configuration Test PASSED! Carrier: ${carrierName}`);
    });
});
