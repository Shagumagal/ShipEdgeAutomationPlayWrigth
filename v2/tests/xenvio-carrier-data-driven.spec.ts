import { test, expect } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { XenvioCarrierConfigPage } from '../page-objects/xenvio-carrier-config-page';
import carrierConfigs from '../../data/carrier-configs.json';

/**
 * Xenvio Carrier Configuration — Data-Driven Test (v2 PrimeNG)
 *
 * Generic test that creates ANY carrier type using data from:
 *   data/carrier-configs.json
 *
 * Each carrier entry defines:
 *   - carrierSearchName: what to type in the search box
 *   - displayName: the mat-card text to click
 *   - name/description: the carrier identity fields
 *   - credentials: { fieldLabel: value } → fills dynamic mat-form-field inputs
 *
 * Usage:
 *   # Run ALL carriers defined in the JSON:
 *   npx playwright test v2/tests/xenvio-carrier-data-driven.spec.ts --project=xenvio-v2
 *
 *   # Run a specific carrier by filtering on its name:
 *   npx playwright test v2/tests/xenvio-carrier-data-driven.spec.ts --project=xenvio-v2 -g "PowerShip"
 *
 * To add a new carrier: just add an entry to data/carrier-configs.json.
 * No code changes needed.
 */

// ─── Type for a carrier config entry ──────────────────────────
interface CarrierConfig {
    id: string;
    carrierSearchName: string;
    displayName: string;
    name: string;
    description: string;
    credentials: Record<string, string>;
}

const carriers = carrierConfigs.carriers as CarrierConfig[];

test.describe('Xenvio Carrier Configuration — Data-Driven (v2 PrimeNG)', () => {

    for (const carrier of carriers) {

        test(`TC-Xenvio-Carrier-DD: Create carrier [${carrier.displayName}] and verify`, async ({
            xenvioLoginPage,
            xenvioDashboardPage,
        }, testInfo) => {

            // ─── Environment Variables ────────────────────────────
            const config = {
                url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
                email: process.env.XENVIO_EMAIL!,
                pass: process.env.XENVIO_PASSWORD!,
                app: process.env.APP_XENVIO!,
                warehouse: process.env.WAREHOUSE_XENVIO!,
            };

            // Generate a unique carrier name to avoid collisions
            const now = new Date();
            const timestamp = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, '0'),
                String(now.getDate()).padStart(2, '0'),
            ].join('-') + '_' +
                String(now.getHours()).padStart(2, '0') + 'h' +
                String(now.getMinutes()).padStart(2, '0');

            const carrierName = `${carrier.name} ${timestamp}`;
            const credentialCount = Object.keys(carrier.credentials).length;

            // ─── Allure Metadata ─────────────────────────────────
            await AllureHelper.applyTestMetadata({
                displayName: `Create ${carrier.displayName} Carrier — ${carrierName}`,
                owner: 'QA Automation Team',
                tags: ['xenvio', 'carrier', 'data-driven', 'v2', carrier.id],
                severity: 'critical',
                epic: 'Xenvio',
                feature: 'Carrier Configuration (Data-Driven)',
                story: `Create ${carrier.displayName} carrier`,
                parentSuite: 'Xenvio Configuration Suite',
                suite: 'Carrier Tests — Data-Driven',
                subSuite: carrier.displayName,
                url: config.url,
                environment: process.env.ENV_NAME || 'QA',
            });

            console.log(`\n🚚 Data-Driven Carrier Configuration`);
            console.log(`   Carrier Type : ${carrier.displayName}`);
            console.log(`   Name         : ${carrierName}`);
            console.log(`   Credentials  : ${credentialCount} field(s)`);
            console.log(`   Warehouse    : ${config.warehouse}`);

            // ═══════════════════════════════════════════════════════
            // STEP 1: Login and Open Shipper View
            // ═══════════════════════════════════════════════════════

            const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
                xenvioLoginPage, xenvioDashboardPage, config
            );

            const carrierPage = new XenvioCarrierConfigPage(popupPage);

            // ═══════════════════════════════════════════════════════
            // STEP 2: Navigate to Configuration → Carriers
            // ═══════════════════════════════════════════════════════

            await allure.step('2. Open Configuration → Carriers', async () => {
                await carrierPage.clickConfigMenuButton();
                await carrierPage.clickConfigurationMenuItem();
                await carrierPage.selectLocation(config.warehouse);
                await carrierPage.clickCarriersStep();
                console.log('✅ On Carriers page');
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // STEP 3: Search and Select Carrier Type
            // ═══════════════════════════════════════════════════════

            await allure.step(`3. Search and select carrier: ${carrier.displayName}`, async () => {
                await carrierPage.searchCarrier(carrier.carrierSearchName);
                await carrierPage.selectCarrier(carrier.displayName);
                console.log(`✅ Carrier "${carrier.displayName}" selected`);
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // STEP 4: Fill Carrier Form (Name + Description + Dynamic Credentials)
            // ═══════════════════════════════════════════════════════

            await allure.step('4. Fill carrier form', async () => {
                // Convert credentials object → dynamic fields array
                const dynamicFields = Object.entries(carrier.credentials).map(
                    ([label, value]) => ({ label, value })
                );

                await carrierPage.fillCarrierForm({
                    name: carrierName,
                    description: carrier.description,
                    dynamicFields,
                });

                // Log all credentials filled (redacted)
                for (const { label } of dynamicFields) {
                    console.log(`  ✓ Field "${label}" filled`);
                }

                await allure.attachment(
                    'Carrier Config',
                    JSON.stringify({
                        carrierType: carrier.displayName,
                        name: carrierName,
                        fieldsCount: credentialCount,
                        fields: Object.keys(carrier.credentials),
                    }, null, 2),
                    'application/json'
                );

                console.log('✅ Carrier form filled');
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // STEP 5: Save Carrier
            // ═══════════════════════════════════════════════════════

            await allure.step('5. Save carrier', async () => {
                await carrierPage.clickSave();
                console.log('✅ Carrier saved');
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // STEP 6: Navigate to Configured Carriers
            // ═══════════════════════════════════════════════════════

            await allure.step('6. Navigate to configured carriers list', async () => {
                await carrierPage.clickSeeCarriersConfigured();
                console.log('✅ Configured carriers list visible');
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // STEP 7: Verify Carrier Created
            // ═══════════════════════════════════════════════════════

            await allure.step(`7. Verify "${carrierName}" exists in configured carriers`, async () => {
                const isVisible = await carrierPage.isCarrierVisibleInList(carrierName);
                expect(
                    isVisible,
                    `Carrier "${carrierName}" must be visible in the configured carriers list`
                ).toBe(true);

                console.log(`✅ Carrier "${carrierName}" verified in list`);
                await popupPage.waitForTimeout(1000);
                await AllureHelper.attachScreenShot(popupPage);
            });

            // ═══════════════════════════════════════════════════════
            // STEP 8: Click on the carrier to verify details
            // ═══════════════════════════════════════════════════════

            await allure.step('8. Click carrier to verify details panel', async () => {
                await carrierPage.clickConfiguredCarrier(carrierName);
                console.log(`✅ Carrier details panel opened for: ${carrierName}`);
                await popupPage.waitForTimeout(1000);
                await AllureHelper.attachScreenShot(popupPage);
                console.log('📸 Final screenshot captured');
            });

            console.log(`\n🎉 Data-Driven Carrier Test PASSED!`);
            console.log(`   Carrier: ${carrier.displayName} → "${carrierName}"`);
            console.log(`   Credentials filled: ${credentialCount}`);
        });
    }
});
