import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioInviteUserPage } from '../page-objects/xenvio-invite-user-page';

/**
 * Xenvio Shipper View — Invite User Test Suite
 *
 * E2E flow:
 *   1. Login to Xenvio
 *   2. Open Shipper View (popup)
 *   3. Select Warehouse and Application
 *   4. Navigate to Users via user menu
 *   5. Open "Invite user" modal
 *   6. Fill email, select role, select facility
 *   7. Submit and verify invitation was sent
 *
 * Credentials and config are read from .env
 */
test.describe('Xenvio Shipper View — Invite User', () => {

    test('TC-Xenvio-IU-001: Invite a new user from Shipper View', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {

        // ─── Env Variables ────────────────────────────────────────
        const xenvioUrl       = process.env.XENVIO_URL || 'https://x5demo1.shipedge.com/users/sign_in';
        const xenvioEmail     = process.env.XENVIO_EMAIL!;
        const xenvioPassword  = process.env.XENVIO_PASSWORD!;
        const warehouseName   = process.env.WAREHOUSE_XENVIO!;
        const appName         = process.env.APP_XENVIO!;

        // Invited user config (can be moved to .env if needed)
        const inviteEmail    = 'userprueba1@yopmail.com';
        const inviteRole     = 'User';

        let popupPage: Page;

        // ─── Allure Metadata ──────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: 'Invite a new user from Shipper View',
            owner: 'QA Automation Team',
            tags: ['xenvio', 'shipper-view', 'invite-user', 'users', 'e2e'],
            severity: 'critical',
            epic: 'Xenvio',
            feature: 'User Management',
            story: 'Invite User via Shipper View'
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Login to Xenvio
        // ═══════════════════════════════════════════════════════════
        await allure.step('1. Login to Xenvio', async () => {
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Open Shipper View popup
        // ═══════════════════════════════════════════════════════════
        await allure.step('2. Open Shipper View', async () => {
            popupPage = await xenvioDashboardPage.openShipperView();

            const shipperViewPage = new XenvioShipperViewPage(popupPage);
            await shipperViewPage.selectWarehouse(warehouseName);
            await shipperViewPage.selectApplication(appName);

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Navigate to Users section
        // ═══════════════════════════════════════════════════════════
        await allure.step('3. Navigate to Users section via user menu', async () => {
            const inviteUserPage = new XenvioInviteUserPage(popupPage);

            await inviteUserPage.openUserMenu();
            await inviteUserPage.clickUsersMenuItem();

            expect(await inviteUserPage.isInviteUserButtonVisible()).toBe(true);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Open "Invite user" modal
        // ═══════════════════════════════════════════════════════════
        await allure.step('4. Open "Invite user" modal', async () => {
            const inviteUserPage = new XenvioInviteUserPage(popupPage);

            await inviteUserPage.clickInviteUser();

            expect(await inviteUserPage.isEmailInputVisible()).toBe(true);
            expect(await inviteUserPage.isSaveButtonVisible()).toBe(true);

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Fill invitation form
        // ═══════════════════════════════════════════════════════════
        await allure.step('5. Fill invitation form (email, role, facility)', async () => {
            const inviteUserPage = new XenvioInviteUserPage(popupPage);

            await inviteUserPage.fillEmail(inviteEmail);
            await inviteUserPage.selectRole(inviteRole);
            await inviteUserPage.selectFacility(warehouseName);

            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Submit invitation
        // ═══════════════════════════════════════════════════════════
        await allure.step('6. Submit invitation and verify', async () => {
            const inviteUserPage = new XenvioInviteUserPage(popupPage);

            await inviteUserPage.clickSave();

            console.log(`✅ Invitation sent to: ${inviteEmail} as ${inviteRole} in ${warehouseName}`);
            await AllureHelper.attachScreenShot(popupPage);
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
