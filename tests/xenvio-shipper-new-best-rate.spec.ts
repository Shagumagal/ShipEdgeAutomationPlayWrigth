import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioBestRatePage } from '../page-objects/xenvio-best-rate-page';

/**
 * Xenvio Shipper View – New Best Rate Test Suite
 *
 * Tests the end-to-end flow for creating a Best Rate in Shipper View → Configuration.
 *
 * ─── Shared Setup (reused from carrier-configuration flow) ──────────
 *   1. Login to Xenvio
 *   2. Open Shipper View (popup)
 *   3. Open Configuration menu → Click "Configuration"
 *   4. Select the warehouse / location card
 *   5. Click "Continue" → Best Rate view loads
 *
 * ─── New Best Rate Flow ──────────────────────────────────────────────
 *   6. Click "New Best Rate"
 *   7. Fill Name, Description, Transit Days, Minimum Price
 *   8. Click "Save & Continue" → Verify SUCCESS toast
 *   9. Assign shipping codes via the arrow (Select) buttons
 *       - Verify each code appears in the assigned list after moving it
 *  10. Click "Done" (shipping codes step)
 *  11. Wait 1 second and capture final screenshot of the "Choose Best Rate" view
 *       showing the newly created Best Rate card as evidence
 *
 * Prerequisites:
 *   - XENVIO_URL, XENVIO_EMAIL, XENVIO_PASSWORD in .env
 *   - WAREHOUSE_XENVIO in .env (e.g. "qa20")
 */
test.describe('Xenvio Shipper View – Best Rate Configuration', () => {

    test('TC-Xenvio-BestRate-001: Create a new Best Rate and assign shipping codes', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {

        // ─── Environment Variables ────────────────────────────────
        const config = {
            url: process.env.XENVIO_URL || 'https://x52.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        // Generate a unique name to avoid duplicates on each run
        const bestRateName = XenvioBestRatePage.generateBestRateName('Best Rate Auto');
        const bestRateDescription = `Automated Best Rate – ${new Date().toISOString().slice(0, 10)}`;

        // Shipping codes to assign (derived from recorded locators)
        // The order matters: each "Select {label}" button moves one code to the assigned list.
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
            owner: "QA Automation Team",
            tags: ["xenvio", "best-rate", "configuration", "shipper-view", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Best Rate Configuration",
            story: "Create a new Best Rate with assigned shipping codes",
            parentSuite: "Xenvio Configuration Suite",
            suite: "Best Rate Tests",
            subSuite: "Best Rate Creation",
            url: config.url,
            environment: process.env.ENV_NAME || 'QA',
        });

        console.log(`\n⭐ Best Rate Configuration Test`);
        console.log(`   Name      : ${bestRateName}`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login to Xenvio
        // ═══════════════════════════════════════════════════════════

        let popupPage = await allure.step('1. Login to Xenvio', async () => {
            await xenvioLoginPage.navigateToLogin(config.url);
            await xenvioLoginPage.login(config.email, config.pass);
            console.log('✅ Logged in to Xenvio');
            return null as unknown as import('@playwright/test').Page;
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Open Shipper View
        // ═══════════════════════════════════════════════════════════

        popupPage = await allure.step('2. Open Shipper View', async () => {
            const popup = await xenvioDashboardPage.openShipperView();
            console.log('✅ Shipper View popup opened');
            await AllureHelper.attachScreenShot(popup);
            return popup;
        });

        // Instantiate the Best Rate Page Object on the popup page
        const bestRatePage = new XenvioBestRatePage(popupPage);

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Navigate to Configuration
        // Reuses the same Config Menu flow as carrier-configuration
        // ═══════════════════════════════════════════════════════════

        await allure.step('3. Open Configuration Menu', async () => {
            await bestRatePage.clickConfigMenuButton();
            await bestRatePage.clickConfigurationMenuItem();
            console.log('✅ Navigated to Configuration');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Select Location / Warehouse
        // Same as carrier-configuration: click the mat-card with warehouse name
        // ═══════════════════════════════════════════════════════════

        await allure.step('4. Select Location / Warehouse', async () => {
            await bestRatePage.selectLocation(config.warehouse);
            console.log(`✅ Warehouse selected: ${config.warehouse}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Click Continue → Enter Best Rate Flow
        // This is where the new Best Rate flow starts (differs from carrier flow)
        // ═══════════════════════════════════════════════════════════

        await allure.step('5. Click Continue to enter Best Rate view', async () => {
            await bestRatePage.clickContinue();
            console.log('✅ Clicked Continue – Best Rate section loaded');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Click New Best Rate
        // ═══════════════════════════════════════════════════════════

        await allure.step('6. Click "New Best Rate"', async () => {
            await bestRatePage.clickNewBestRate();
            console.log('✅ New Best Rate form visible');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Fill Best Rate Form
        // ═══════════════════════════════════════════════════════════

        await allure.step('7. Fill Best Rate form fields', async () => {
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
        // STEP 8: Save & Continue + Verify SUCCESS toast
        // ═══════════════════════════════════════════════════════════

        await allure.step('8. Save Best Rate and verify success toast', async () => {
            await bestRatePage.clickSaveAndContinue();

            // Assert the SUCCESS toast appeared
            const toastVisible = await bestRatePage.verifySuccessToast();
            expect(toastVisible, 'SUCCESS toast must appear after saving the Best Rate').toBe(true);

            console.log('✅ Best Rate saved – SUCCESS toast confirmed');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 9: Assign Shipping Codes (arrow → move to Best Rate)
        // Capture count before/after to verify each code was moved
        // ═══════════════════════════════════════════════════════════

        await allure.step('9. Assign shipping codes to Best Rate', async () => {
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
        // STEP 10: Verify assigned shipping codes appear in the list
        // Each code (EUSFRBD, EUSEM, EUSALP) must be visible in the
        // right-hand "assigned" panel after being moved
        // ═══════════════════════════════════════════════════════════

        await allure.step('10. Verify shipping codes were assigned correctly', async () => {
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
        // STEP 11: Click Done (shipping codes step)
        // ═══════════════════════════════════════════════════════════

        await allure.step('11. Confirm shipping codes – click Done', async () => {
            await bestRatePage.clickDone();
            console.log('✅ Shipping codes step confirmed');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 12: Wait 1 second and capture the "Choose Best Rate" view
        // We verify the created card is visible WITHOUT clicking into it
        // ═══════════════════════════════════════════════════════════

        await allure.step('12. Capture created Best Rate card as evidence', async () => {
            // Verify the card is visible in the "Choose Best Rate" list
            const cardVisible = await bestRatePage.isBestRateCardVisible(bestRateName);
            expect(
                cardVisible,
                `Best Rate card "${bestRateName}" must be visible in the Choose Best Rate view`
            ).toBe(true);

            console.log(`✅ Best Rate card visible: "${bestRateName}"`);

            // Wait 1 second so the UI settles before the final screenshot
            await popupPage.waitForTimeout(1000);

            // Final screenshot: evidence of the created Best Rate card
            await AllureHelper.attachScreenShot(popupPage);
            console.log('📸 Final screenshot captured – Best Rate confirmed');
        });

        console.log(`\n🎉 Best Rate Configuration Test PASSED!`);
        console.log(`   Best Rate: ${bestRateName}`);
    });

    // ─── Error Artifact Capture ───────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
