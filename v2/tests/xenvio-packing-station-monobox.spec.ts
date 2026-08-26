import { Page } from '@playwright/test';
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { generateUSRecipient, StandardPackage } from '../../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';
import { XenvioPackingStationPage } from '../page-objects/xenvio-packing-station-page';
import { captureTestFailure } from '../../lib/test-failure-capture';

/**
 * ─── Xenvio Packing Station (v2 — PrimeNG) ──────────────────────────────────
 *
 * E2E flow:
 *   1. Login to Xenvio & Open Shipper View popup
 *   2. Create a standard order (random recipient)
 *   3. Create 2 additional boxes (total 3 boxes) and add items to each box (3 items)
 *   4. Switch to "Packing station" tab in Shipper View header
 *   5. Open box type dropdown in "Select box type" dialog, pick first option, and confirm
 *   6. Scan all items by clicking each item in the left sidebar
 *   7. In the "Close this box" dialog, click "Apply" to set calculated weight & seal box
 *   8. Verify 1 ended box in right panel with all packed items
 *   9. Click "Shipping" to commit packed monobox and return to Shipment Details
 */
test.describe('Xenvio Packing Station (v2 PrimeNG)', () => {

    test('TC-Xenvio-PackingStation-001: Create 3-box order and pack all items into single box via Packing Station', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        const recipient = generateUSRecipient();
        const boxesCount = 3;

        await AllureHelper.applyTestMetadata({
            displayName: 'Packing Station — Monobox Packing Flow (v2 PrimeNG)',
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'packing-station', 'monobox', 'multi-box', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Packing Station (v2 PrimeNG)',
            story:    'Pack multiple items into a single box using Packing Station and proceed to Shipping',
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo1.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n📦 Packing Station Test starting with recipient: ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        let popupPage: Page;

        // ═══════════════════════════════════════════════════════
        // PHASE 1: Login & Navigate to Shipper View
        // ═══════════════════════════════════════════════════════
        popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage,
            xenvioDashboardPage,
            config
        );

        // ═══════════════════════════════════════════════════════
        // PHASE 2: Create Order with 3 Boxes and 3 Items
        // ═══════════════════════════════════════════════════════
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage,
            recipient,
            StandardPackage,
            config.warehouse
        );

        const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(
            popupPage,
            shipmentNumber
        );

        await XenvioWorkflows.setupDomesticMultiBox(
            popupPage,
            orderToLabelPage,
            boxesCount,
            StandardPackage
        );

        // ═══════════════════════════════════════════════════════
        // PHASE 3: Navigate to Packing Station
        // ═══════════════════════════════════════════════════════
        const packingStationPage = new XenvioPackingStationPage(popupPage);

        await test.step('6. Navigate to Packing Station Tab', async () => {
            await packingStationPage.openPackingStationTab();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 4: Select Box Type from Autocomplete Dropdown
        // ═══════════════════════════════════════════════════════
        await test.step('7. Select Box Packaging and Confirm', async () => {
            await packingStationPage.selectAndConfirmBoxType();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 5: Scan Items One by One
        // ═══════════════════════════════════════════════════════
        await test.step('8. Scan all Items by Clicking in Sidebar', async () => {
            const totalScanned = await packingStationPage.scanAllItemsByClicking();
            console.log(`✅ Total items scanned into current box: ${totalScanned}`);
            expect(totalScanned).toBeGreaterThanOrEqual(1);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 6: Close Box — Click "Apply" (closes dialog automatically)
        // ═══════════════════════════════════════════════════════
        await test.step('9. Close Box — Apply Calculated Weight', async () => {
            await packingStationPage.waitForCloseBoxDialog();
            await packingStationPage.applyCalculatedWeightAndClose(); // Apply closes dialog
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // PHASE 7: Verify Ended Boxes & Click Shipping
        // ═══════════════════════════════════════════════════════
        await test.step('10. Verify Ended Box and Click Shipping', async () => {
            await packingStationPage.verifyEndedBoxesCount(1);
            await packingStationPage.clickShipping();
            await popupPage.waitForTimeout(3000); // Allow navigation back to details
            await AllureHelper.attachScreenShot(popupPage);
        });

        console.log(`\n🎉 Packing Station Monobox flow completed successfully for shipment: ${shipmentNumber}\n`);
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            await captureTestFailure(
                page,
                testInfo,
                new Error(testInfo.error?.message || 'Packing Station test failed')
            );
        }
    });
});
