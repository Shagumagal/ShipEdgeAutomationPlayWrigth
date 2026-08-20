import { Page } from '@playwright/test';
import { test, expect } from '../../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from "../../lib/test-failure-capture";
import { XenvioShipperViewPage } from '../page-objects/xenvio-shipper-view-page';
import { XenvioNewOrderPage } from '../page-objects/xenvio-new-order-page';
import { XenvioShortcutsPage } from '../page-objects/xenvio-shortcuts-page';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';

/**
 * Xenvio Keyboard Shortcuts Test Suite
 *
 * E2E flow:
 *   1. Login to Xenvio
 *   2. Open Shipper View
 *   3. Create a New Order (adds random recipient, product)
 *   4. Save order to generate a Shipment ID
 *   5. Search for that new Shipment ID
 *   6. Open the user menu → Click "Shortcuts"
 *   7. Verify the Keyboard Shortcuts modal appears with the expected shortcuts
 *   8. Close the modal
 */
test.describe('Xenvio Keyboard Shortcuts', () => {

    test('TC-Xenvio-Shortcuts: Create order and verify Keyboard Shortcuts modal', async ({
        page,
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {

        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: "Keyboard Shortcuts Modal Verification with New Order",
            owner: "QA Automation Team",
            tags: ["xenvio", "shortcuts", "smoke", "new-order"],
            severity: "normal",
            epic: "Xenvio",
            feature: "Keyboard Shortcuts",
            story: "Create order, open and verify the Keyboard Shortcuts configuration modal",
            parentSuite: "Xenvio Suite",
            suite: "Shipper View Tests",
            subSuite: "Keyboard Shortcuts"
        });

        const xenvioUrl = process.env.XENVIO_URL || 'https://x5demo1.shipedge.com/users/sign_in';
        const xenvioEmail = process.env.XENVIO_EMAIL!;
        const xenvioPassword = process.env.XENVIO_PASSWORD!;
        const warehouseName = process.env.WAREHOUSE_XENVIO!;
        const appName = process.env.APP_XENVIO!;

        console.log(`\n⌨️ Shortcuts Test starting with random order: ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        let popupPage: Page;
        let createdShipmentNumber: string | null = null;

        // ═══════════════════════════════════════════════════════
        // PHASE 1: Login & Navigate to Shipper View
        // ═══════════════════════════════════════════════════════

        await allure.step('1. Login to Xenvio', async () => {
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
        });

        await allure.step('2. Open Shipper View', async () => {
            popupPage = await xenvioDashboardPage.openShipperView();
            const shipperViewPage = new XenvioShipperViewPage(popupPage);
            await shipperViewPage.selectWarehouse(warehouseName);
            await shipperViewPage.selectApplication(appName);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 2: Create a New Order (Consolidated Flow)
        // ═══════════════════════════════════════════════════════

        await allure.step('3. Create New Order', async () => {
            const newOrderPage = new XenvioNewOrderPage(popupPage);
            createdShipmentNumber = await newOrderPage.createOrderFlow(recipient, StandardPackage, warehouseName);
            
            expect(createdShipmentNumber).not.toBeNull();
            console.log(`✅ Order flow finished! Shipment: ${createdShipmentNumber}`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 3: Search for the created shipment
        // ═══════════════════════════════════════════════════════

        await allure.step('4. Search for newly created shipment', async () => {
            const shipperViewPage = new XenvioShipperViewPage(popupPage);
            await shipperViewPage.searchShipment(createdShipmentNumber!);
            console.log(`✅ Shipment ${createdShipmentNumber} loaded in Shipper View`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 4: Open Shortcuts Modal
        // ═══════════════════════════════════════════════════════

        await allure.step('5. Open user menu and click Shortcuts', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            await shortcutsPage.openShortcutsModal();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 5: Verify Modal Content
        // ═══════════════════════════════════════════════════════

        await allure.step('6. Verify Keyboard Shortcuts modal is visible', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            const isVisible = await shortcutsPage.isShortcutsModalVisible();
            expect(isVisible).toBe(true);
            console.log('✅ Keyboard Shortcuts modal confirmed visible');
        });

        await allure.step('7. Verify default shortcuts are listed', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            await shortcutsPage.verifyDefaultShortcuts();
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('8. Close the modal', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            await shortcutsPage.closeModal();
            await AllureHelper.attachScreenShot(popupPage);
            console.log('✅ Shortcuts test completed successfully');
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
