import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import { faker } from '@faker-js/faker';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Xenvio Shipper View — Invite User & Register Test Suite
 *
 * E2E flow:
 *   1. Login to Xenvio (admin)
 *   2. Open Shipper View popup
 *   3. Navigate to Users section
 *   4. Invite a new user (email, role, facility)
 *   5. Activate the invited user from the users list
 *   6. Logout from Shipper View (admin)
 *   7. Navigate to YopMail inbox for the invited user
 *   8. Click "Accept invitation" link in the email
 *   9. Complete the Keycloak registration form (password, name)
 *
 * Credentials and config are read from .env
 */
test.describe('Xenvio Shipper View — Invite User & Register', () => {

    test('TC-Xenvio-IU-001: Invite, activate and register a new user from Shipper View', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage,
        xenvioShipperViewPage,
        xenvioInviteUserPage,
        yopmailRegisterPage,
    }) => {

        // ─── Env Variables ────────────────────────────────────────
        const xenvioUrl      = process.env.XENVIO_URL || 'https://x5test.shipedge.com/users/sign_in';
        const xenvioEmail    = process.env.XENVIO_EMAIL!;
        const xenvioPassword = process.env.XENVIO_PASSWORD!;
        const warehouseName  = process.env.WAREHOUSE_XENVIO!;
        const appName        = process.env.APP_XENVIO!;

        // ─── Invited User Config ──────────────────────────────────
        // Using a yopmail address so we can verify the inbox in the test
        const inviteEmail    = `qa-${faker.string.alphanumeric(6).toLowerCase()}@yopmail.com`;
        const inviteRole     = 'Warehouse Manager';
        const newUserPassword = process.env.INVITE_USER_PASSWORD || 'hBpp4D9mpmR@ZFu';
        const newUserFirstName = faker.person.firstName();
        const newUserLastName  = faker.person.lastName();

        let popupPage: Page;

        // ─── Allure Metadata ──────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: 'Invite, Activate and Register a new user from Shipper View',
            owner: 'QA Automation Team',
            tags: ['xenvio', 'shipper-view', 'invite-user', 'register', 'e2e'],
            severity: 'critical',
            epic: 'Xenvio',
            feature: 'User Management',
            story: 'Invite User via Shipper View',
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login to Xenvio (admin)
        // ═══════════════════════════════════════════════════════════
        await allure.step('1. Login to Xenvio as admin', async () => {
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Open Shipper View popup
        // ═══════════════════════════════════════════════════════════
        await allure.step('2. Open Shipper View and select environment', async () => {
            popupPage = await xenvioDashboardPage.openShipperView();

            // Bind the injected page objects to the newly opened popup
            xenvioShipperViewPage.setPage(popupPage);
            xenvioInviteUserPage.setPage(popupPage);

            await xenvioShipperViewPage.selectWarehouse(warehouseName);
            await xenvioShipperViewPage.selectApplication(appName);

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Navigate to Users section
        // ═══════════════════════════════════════════════════════════
        await allure.step('3. Navigate to Users section via user menu', async () => {
            await xenvioInviteUserPage.openUserMenu();
            await xenvioInviteUserPage.clickUsersMenuItem();

            expect(await xenvioInviteUserPage.isInviteUserButtonVisible()).toBe(true);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Open "Invite user" modal and fill form
        // ═══════════════════════════════════════════════════════════
        await allure.step('4. Open "Invite user" modal and fill invitation form', async () => {
            await xenvioInviteUserPage.clickInviteUser();

            expect(await xenvioInviteUserPage.isEmailInputVisible()).toBe(true);
            expect(await xenvioInviteUserPage.isSaveButtonVisible()).toBe(true);

            await xenvioInviteUserPage.fillEmail(inviteEmail);
            await xenvioInviteUserPage.selectRole(inviteRole);
            await xenvioInviteUserPage.selectFacility(warehouseName);

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Submit invitation
        // ═══════════════════════════════════════════════════════════
        await allure.step('5. Submit invitation and verify success', async () => {
            await xenvioInviteUserPage.clickSave();

            const isSuccess = await xenvioInviteUserPage.isSuccessVisible();
            expect(isSuccess, 'Success message or toast should be visible after save').toBe(true);

            console.log(`✅ Invitation sent to: ${inviteEmail} as ${inviteRole} in ${warehouseName}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Activate the invited user
        // ═══════════════════════════════════════════════════════════
        await allure.step('6. Filter and activate the invited user', async () => {
            await xenvioInviteUserPage.filterByEmail(inviteEmail);
            await xenvioInviteUserPage.clickActivateUser();

            console.log(`✅ User activated: ${inviteEmail}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Admin logs out from Shipper View
        // ═══════════════════════════════════════════════════════════
        await allure.step('7. Admin logs out from Shipper View', async () => {
            await xenvioInviteUserPage.logout();

            console.log('✅ Admin logged out from Shipper View');
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 8: Open YopMail inbox and get invitation email
        // ═══════════════════════════════════════════════════════════
        await allure.step('8. Open YopMail inbox and find invitation email', async () => {
            // Navigate to YopMail on the main page (not popup)
            yopmailRegisterPage.setPage(page);

            await yopmailRegisterPage.navigateToYopmail();
            await yopmailRegisterPage.openInbox();

            await AllureHelper.attachScreenShot(page);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 9: Accept invitation and complete registration
        // ═══════════════════════════════════════════════════════════
        await allure.step('9. Accept invitation and complete registration form', async () => {
            // The link opens a new popup page for Keycloak registration
            const registrationPage = await yopmailRegisterPage.clickAcceptInvitation();

            // Bind the page object to the new popup
            yopmailRegisterPage.setPage(registrationPage);

            expect(await yopmailRegisterPage.isPasswordInputVisible()).toBe(true);

            await yopmailRegisterPage.completeRegistration({
                password: newUserPassword,
                firstName: newUserFirstName,
                lastName: newUserLastName,
            });

            console.log(`✅ Registration completed for: ${inviteEmail} (${newUserFirstName} ${newUserLastName})`);
            await AllureHelper.attachScreenShot(registrationPage);
        });
    });

    // ─── After Hook ───────────────────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
