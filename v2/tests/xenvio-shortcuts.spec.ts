import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { XenvioShortcutsPage } from '../page-objects/xenvio-shortcuts-page';

/**
 * ─── Xenvio Keyboard Shortcuts (v2 — PrimeNG) ──────────────────────────────
 *
 * E2E flow:
 *   1. Login to Xenvio
 *   2. Open Shipper View
 *   3. Create a New Order (random recipient)
 *   4. Open user menu → Click "Shortcuts"
 *   5. Verify the Keyboard Shortcuts modal with expected shortcuts
 *   6. Close the modal
 */
test.describe('Xenvio Keyboard Shortcuts (v2 PrimeNG)', () => {

    test('TC-Xenvio-Shortcuts: Create order and verify Keyboard Shortcuts modal', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: 'Keyboard Shortcuts Modal Verification v2',
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'shortcuts', 'smoke', 'new-order', 'v2', 'primeng'],
            severity: 'normal',
            epic:     'Xenvio',
            feature:  'Keyboard Shortcuts (v2 PrimeNG)',
            story:    'Create order, open and verify the Keyboard Shortcuts modal',
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo1.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n⌨️ Shortcuts Test starting with random order: ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        let popupPage: Page;

        // ═══════════════════════════════════════════════════════
        // PHASE 1: Login & Navigate to Shipper View
        // ═══════════════════════════════════════════════════════

        popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // ═══════════════════════════════════════════════════════
        // PHASE 2: Create a New Order
        // ═══════════════════════════════════════════════════════

        const createdShipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage, recipient, StandardPackage, config.warehouse
        );

        expect(createdShipmentNumber).not.toBeNull();
        console.log(`✅ Order created! Shipment: ${createdShipmentNumber}`);

        // ═══════════════════════════════════════════════════════
        // PHASE 3: Open Shortcuts Modal
        // ═══════════════════════════════════════════════════════

        await allure.step('4. Open user menu and click Shortcuts', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            await shortcutsPage.openShortcutsModal();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 4: Verify Modal Content
        // ═══════════════════════════════════════════════════════

        await allure.step('5. Verify Keyboard Shortcuts modal is visible', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            const isVisible = await shortcutsPage.isShortcutsModalVisible();
            expect(isVisible).toBe(true);
            console.log('✅ Keyboard Shortcuts modal confirmed visible');
        });

        await allure.step('6. Verify default shortcuts are listed', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            await shortcutsPage.verifyDefaultShortcuts();
            await AllureHelper.attachScreenShot(popupPage);
        });

        await allure.step('7. Close the modal', async () => {
            const shortcutsPage = new XenvioShortcutsPage(popupPage);
            await shortcutsPage.closeModal();
            await AllureHelper.attachScreenShot(popupPage);
            console.log('✅ Shortcuts test completed successfully');
        });
    });
});
