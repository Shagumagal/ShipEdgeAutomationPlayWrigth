import { test, expect } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { XenvioBestRatePage } from '../page-objects/xenvio-best-rate-page';

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
test.describe('Xenvio Best Rate Configuration (v2 PrimeNG)', { tag: ['@e2e', '@rates'] }, () => {

    test('TC-Xenvio-BestRate-001: Create a new Best Rate and assign shipping codes', async ({
        xenvio,
    }, testInfo) => {
        const config = xenvio.config;

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
            tags: ['xenvio', 'best-rate', 'configuration', 'rates', 'e2e', 'v2', 'primeng'],
            severity: 'normal',
            epic: 'Xenvio',
            feature: 'Best Rate Configuration (v2 PrimeNG)',
            story: 'Create a new Best Rate with assigned shipping codes',
            parentSuite: 'Xenvio Configuration Suite',
            suite: 'Best Rate Tests',
            subSuite: 'Best Rate Creation',
            url: config.url,
            environment: process.env.ENV_NAME || 'QA',
        });

        await AllureHelper.addRunParameters({
            Name: `${bestRateName}`,
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login and Open Shipper View
        // ═══════════════════════════════════════════════════════════

        const session = await xenvio.openSession();
        const popupPage = session.page;

        // Create the v2 Best Rate page object on the popup page
        const bestRatePage = new XenvioBestRatePage(popupPage);

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Navigate to Configuration
        // ═══════════════════════════════════════════════════════════

        await allure.step('Open Configuration Menu', async () => {
            await bestRatePage.clickConfigMenuButton();
            await bestRatePage.clickConfigurationMenuItem();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Select Location / Warehouse
        // ═══════════════════════════════════════════════════════════

        await allure.step('Select Location / Warehouse', async () => {
            await bestRatePage.selectLocation(config.warehouse);
            console.log(`✅ Warehouse selected: ${config.warehouse}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Navigate to Best Rate step
        // ═══════════════════════════════════════════════════════════

        await allure.step('Navigate to Best Rate step', async () => {
            await bestRatePage.clickBestRateStep();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Click New Best Rate
        // ═══════════════════════════════════════════════════════════

        await allure.step('Click "New Best Rate"', async () => {
            await bestRatePage.clickNewBestRate();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Fill Best Rate Form
        // ═══════════════════════════════════════════════════════════

        await allure.step('Fill Best Rate form fields', async () => {
            await bestRatePage.fillBestRateForm({
                name: bestRateName,
                description: bestRateDescription,
                transitDays: '1',
                minimumPrice: '1',
            });
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Save & Continue + Verify SUCCESS toast
        // ═══════════════════════════════════════════════════════════

        await allure.step('Save Best Rate and verify success toast', async () => {
            await bestRatePage.clickSaveAndContinue();

            // Assert the SUCCESS toast appeared
            const toastVisible = await bestRatePage.verifySuccessToast();
            expect(toastVisible, 'SUCCESS toast must appear after saving the Best Rate').toBe(true);

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 8: Assign Shipping Codes
        // ═══════════════════════════════════════════════════════════

        await allure.step('Assign shipping codes to Best Rate', async () => {
            console.log('\n📦 Beginning shipping code assignment...');

            for (const { label, occurrence } of shippingCodesToAssign) {
                console.log(`  → Assigning code: "${label}"...`);
                await bestRatePage.assignShippingCode(label, occurrence ?? 0);
                console.log(`     ✅ "${label}" assigned`);
                await popupPage.waitForTimeout(500);
            }

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 9: Verify assigned shipping codes
        // ═══════════════════════════════════════════════════════════

        await allure.step('Verify shipping codes were assigned correctly', async () => {
            console.log('\n🔍 Verifying assigned shipping codes...');

            for (const code of expectedAssignedCodes) {
                const isAssigned = await bestRatePage.isShippingCodeAssigned(code);
                expect(
                    isAssigned,
                    `Shipping code "${code}" must appear in the assigned list after being selected`
                ).toBe(true);
                console.log(`   ✅ "${code}" verified in assigned list`);
            }

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 10: Click Done (shipping codes step)
        // ═══════════════════════════════════════════════════════════

        await allure.step('Confirm shipping codes – click Done', async () => {
            await bestRatePage.clickDone();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 11: Verify Best Rate card in "Choose Best Rate" list
        // ═══════════════════════════════════════════════════════════

        await allure.step('Capture created Best Rate card as evidence', async () => {
            const cardVisible = await bestRatePage.isBestRateCardVisible(bestRateName);
            expect(
                cardVisible,
                `Best Rate card "${bestRateName}" must be visible in the Choose Best Rate view`
            ).toBe(true);

            console.log(`✅ Best Rate card visible: "${bestRateName}"`);

            // Wait for UI to settle before final screenshot
            await popupPage.waitForTimeout(1000);
            await AllureHelper.attachScreenShot(popupPage);
        });

        await AllureHelper.addRunParameters({
            'Best Rate': `${bestRateName}`,
        });
    });
});
