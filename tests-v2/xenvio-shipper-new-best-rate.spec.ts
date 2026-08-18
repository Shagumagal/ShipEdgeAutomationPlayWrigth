import { test, expect } from '../lib-v2/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../lib/allure-helper';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';
import { XenvioBestRatePage } from '../page-objects-v2/xenvio-best-rate-page';

/**
 * Xenvio Best Rate Configuration Test Suite (v2 — PrimeNG / Angular)
 *
 * Tests the end-to-end flow for creating a new Best Rate in
 * Configuration → Best Rate section.
 *
 * Flow:
 *   1. Login and open Shipper View
 *   2. Navigate to Configuration → Select Warehouse
 *   3. Navigate to Best Rate step
 *   4. Click "New Best Rate" → Fill form
 *   5. Save & Continue → Verify SUCCESS toast
 *   6. Assign shipping codes
 *   7. Verify assigned codes → Click Done
 *   8. Verify Best Rate card visible in list
 *
 * Prerequisites (in .env):
 *   - XENVIO_URL, XENVIO_EMAIL, XENVIO_PASSWORD
 *   - WAREHOUSE_XENVIO (e.g. "qa20")
 */
test.describe('Xenvio Best Rate Configuration (v2 PrimeNG)', () => {

    test('TC-Xenvio-BestRate-001: Create a new Best Rate and assign shipping codes', async ({
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

        // Generate a unique name to avoid duplicates on each run
        const bestRateName = XenvioBestRatePage.generateBestRateName('Best Rate Auto', testInfo.workerIndex);
        const bestRateDescription = `Automated Best Rate – ${new Date().toISOString().slice(0, 10)}`;

        // Shipping codes to assign (derived from recorded locators)
        // Each "Select {label}" button moves one code to the assigned list.
        const shippingCodesToAssign: Array<{ label: string; occurrence?: number }> = [
            { label: 'Flat Rate Box - Medium', occurrence: 0 },
            { label: 'Express', occurrence: 1 },
            { label: 'First Class Mail', occurrence: 0 },
        ];

        // Codes expected to appear in the assigned list after moving (for assertions)
        const expectedAssignedCodes = ['EUSFRBD', 'EUSEM', 'EUSALP'];

        // ─── Allure Metadata ─────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Create Best Rate — ${bestRateName}`,
            owner: 'QA Automation Team',
            tags: ['xenvio', 'best-rate', 'configuration', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic: 'Xenvio',
            feature: 'Best Rate Configuration (v2 PrimeNG)',
            story: 'Create a new Best Rate with assigned shipping codes',
            parentSuite: 'Xenvio Configuration Suite',
            suite: 'Best Rate Tests',
            subSuite: 'Best Rate Creation',
            url: config.url,
            environment: process.env.ENV_NAME || 'QA',
        });

        console.log(`\n⭐ Best Rate Configuration Test (v2)`);
        console.log(`   Name      : ${bestRateName}`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login and Open Shipper View
        // ═══════════════════════════════════════════════════════════

        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage, xenvioDashboardPage, config
        );

        // Create the v2 Best Rate page object on the popup page
        const bestRatePage = new XenvioBestRatePage(popupPage);

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Navigate to Configuration
        // ═══════════════════════════════════════════════════════════

        await allure.step('2. Open Configuration Menu', async () => {
            await bestRatePage.clickConfigMenuButton();
            await bestRatePage.clickConfigurationMenuItem();
            console.log('✅ Navigated to Configuration');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Select Location / Warehouse
        // ═══════════════════════════════════════════════════════════

        await allure.step('3. Select Location / Warehouse', async () => {
            await bestRatePage.selectLocation(config.warehouse);
            console.log(`✅ Warehouse selected: ${config.warehouse}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Navigate to Best Rate step
        // ═══════════════════════════════════════════════════════════

        await allure.step('4. Navigate to Best Rate step', async () => {
            await bestRatePage.clickBestRateStep();
            console.log('✅ Best Rate section loaded');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Click New Best Rate
        // ═══════════════════════════════════════════════════════════

        await allure.step('5. Click "New Best Rate"', async () => {
            await bestRatePage.clickNewBestRate();
            console.log('✅ New Best Rate form visible');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Fill Best Rate Form
        // ═══════════════════════════════════════════════════════════

        await allure.step('6. Fill Best Rate form fields', async () => {
            await bestRatePage.fillBestRateForm({
                name: bestRateName,
                description: bestRateDescription,
                transitDays: '1',
                minimumPrice: '1',
            });
            console.log('✅ Best Rate form filled');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Save & Continue + Verify SUCCESS toast
        // ═══════════════════════════════════════════════════════════

        await allure.step('7. Save Best Rate and verify success toast', async () => {
            await bestRatePage.clickSaveAndContinue();

            // Assert the SUCCESS toast appeared
            const toastVisible = await bestRatePage.verifySuccessToast();
            expect(toastVisible, 'SUCCESS toast must appear after saving the Best Rate').toBe(true);

            console.log('✅ Best Rate saved – SUCCESS toast confirmed');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 8: Assign Shipping Codes
        // ═══════════════════════════════════════════════════════════

        await allure.step('8. Assign shipping codes to Best Rate', async () => {
            console.log('\n📦 Beginning shipping code assignment...');

            for (const { label, occurrence } of shippingCodesToAssign) {
                console.log(`  → Assigning code: "${label}"...`);
                await bestRatePage.assignShippingCode(label, occurrence ?? 0);
                console.log(`     ✅ "${label}" assigned`);
                await popupPage.waitForTimeout(500);
            }

            console.log('✅ All shipping codes assigned');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 9: Verify assigned shipping codes
        // ═══════════════════════════════════════════════════════════

        await allure.step('9. Verify shipping codes were assigned correctly', async () => {
            console.log('\n🔍 Verifying assigned shipping codes...');

            for (const code of expectedAssignedCodes) {
                const isAssigned = await bestRatePage.isShippingCodeAssigned(code);
                expect(
                    isAssigned,
                    `Shipping code "${code}" must appear in the assigned list after being selected`
                ).toBe(true);
                console.log(`   ✅ "${code}" verified in assigned list`);
            }

            console.log('✅ All shipping codes verified in assigned list');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 10: Click Done (shipping codes step)
        // ═══════════════════════════════════════════════════════════

        await allure.step('10. Confirm shipping codes – click Done', async () => {
            await bestRatePage.clickDone();
            console.log('✅ Shipping codes step confirmed');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 11: Verify Best Rate card in "Choose Best Rate" list
        // ═══════════════════════════════════════════════════════════

        await allure.step('11. Capture created Best Rate card as evidence', async () => {
            const cardVisible = await bestRatePage.isBestRateCardVisible(bestRateName);
            expect(
                cardVisible,
                `Best Rate card "${bestRateName}" must be visible in the Choose Best Rate view`
            ).toBe(true);

            console.log(`✅ Best Rate card visible: "${bestRateName}"`);

            // Wait for UI to settle before final screenshot
            await popupPage.waitForTimeout(1000);
            await AllureHelper.attachScreenShot(popupPage);
            console.log('📸 Final screenshot captured – Best Rate confirmed');
        });

        console.log(`\n🎉 Best Rate Configuration Test PASSED!`);
        console.log(`   Best Rate: ${bestRateName}`);
    });
});
