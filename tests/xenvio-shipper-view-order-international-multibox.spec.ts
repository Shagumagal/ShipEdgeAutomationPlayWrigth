import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from '../lib/test-failure-capture';
import { InternationalRecipients, StandardInternationalItem } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * ─── Xenvio – International Order Multi-Box Flow ──────────────────────────────
 *
 * Test: TC-Xenvio-Intl-MultiBox-001 — Create a 3-box international order (UK)
 *
 * Flow:
 *  1.  Login + Open Shipper View
 *  2.  Select Warehouse & App
 *  3.  Navigate to New Order
 *  4.  Fill international recipient info (10 Downing St, London, GB)
 *  5.  Continue → Boxes tab (single box created during order flow)
 *  6a. Create 2 additional boxes (3 boxes total)
 *  6b. Add international item details to each box:
 *        – SKU, Weight, Length, Width, Height
 *        – Item Description
 *        – Harmonization Code
 *        – Country of Origin
 *        – Unit Price, Qty
 *  7.  Get Rates
 *  8.  Select Rate (International) → Save & Confirm
 *  9.  Get Labels (wait for Void Label — international may take longer)
 *  10. Intercept task_executor API response → capture finalPostage, shippingCost,
 *      label PDFs (one per box) and commercial invoice document URLs
 */
test.describe('Xenvio Shipper View – International Order Multi-Box', () => {

    test('TC-Xenvio-Intl-MultiBox-001: Create 3-box international order (UK) and get labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {

        const recipient  = InternationalRecipients.uk;
        const item       = StandardInternationalItem;
        const boxesCount = 3;

        // ── Allure metadata ──────────────────────────────────────────────
        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label International Multi-Box (${boxesCount}) — ${recipient.city}, ${recipient.country}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'order-to-label', 'international', 'multibox', 'e2e'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Order-to-Label International',
            story:    `Generate labels for ${boxesCount}-box international order (${recipient.city}, ${recipient.country})`,
        });

        const config = {
            url:       process.env.XENVIO_URL       || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n🌍 International Multi-Box Order`);
        console.log(`   Boxes     : ${boxesCount}`);
        console.log(`   Recipient : ${recipient.name} | ${recipient.city}, ${recipient.country}`);
        console.log(`   Warehouse : ${config.warehouse}`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View (shared workflow)
        // ═══════════════════════════════════════════════════════════════
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage,
            xenvioDashboardPage,
            config,
        );

        // ═══════════════════════════════════════════════════════════════
        // STEP 3-9 — Create Order with international address
        //
        // createStandardOrder internally creates 1 box during the New Order
        // flow. Box weight is set to 5 lbs (larger than the 1 lb item weight
        // declared per box for customs, so carrier validation passes).
        // ═══════════════════════════════════════════════════════════════
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage,
            recipient,
            {
                qty:    item.qty,
                length: item.length,
                width:  item.width,
                height: item.height,
                weight: '5',          // Box weight > commodity weight — carrier validation passes
            },
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);
        await AllureHelper.attachScreenShot(popupPage);

        // ═══════════════════════════════════════════════════════════════
        // STEP 10-11 — Search shipment & open O2L panel (shared workflow)
        // ═══════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ═══════════════════════════════════════════════════════════════
        // STEP 6a — Create additional boxes (boxes 2 and 3)
        //           Box 1 was already created during the New Order flow.
        // ═══════════════════════════════════════════════════════════════
        await test.step(`6a. Create ${boxesCount - 1} additional boxes (2–${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, '5', '10', '8', '6');
                await orderToLabelPage.boxForm.clickApplyBox();

                // After the last additional box, wait for the spinner to settle
                if (i === boxesCount) {
                    console.log('  ⏳ Waiting for loading spinner after last box creation...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }
            }
            console.log(`✅ All ${boxesCount} boxes ready`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 6b — Add international item details to each box
        //           Each box gets its own SKU (intl-sku-1, intl-sku-2, …)
        //           and the same customs fields (harmonization code, CoO).
        // ═══════════════════════════════════════════════════════════════
        await test.step(`6b. Add international item to each of the ${boxesCount} boxes`, async () => {
            for (let i = 0; i < boxesCount; i++) {
                const boxNumber = i + 1;
                const sku       = `intl-sku-${boxNumber}`;

                console.log(`  📝 Adding international item to Box #${boxNumber} (SKU: ${sku})...`);

                // Wait for the loading spinner and any stale forms to clear
                await orderToLabelPage.waitForXenvioLoading(15000);

                // Click "Add Item" for this specific box (zero-based index)
                await orderToLabelPage.boxForm.clickAddItemForBox(i);
                await AllureHelper.attachScreenShot(popupPage);

                // Fill international-specific fields (SKU through CoO + unit price + qty)
                await orderToLabelPage.boxForm.fillInternationalItemDetails({
                    sku:               sku,
                    weight:            item.weight,
                    length:            item.length,
                    width:             item.width,
                    height:            item.height,
                    itemDescription:   item.itemDescription,
                    harmonizationCode: item.harmonizationCode,
                    countryOfOrigin:   item.countryOfOrigin,
                    unitPrice:         item.unitPrice,
                    qty:               item.qty,
                });

                await orderToLabelPage.boxForm.clickApplyItem();

                // After the last box item, wait for the full loading cycle to complete
                if (boxNumber === boxesCount) {
                    console.log('  ⏳ Waiting for loading spinner after last item...');
                    await orderToLabelPage.waitForXenvioLoading(30000);
                }

                console.log(`  ✅ Box #${boxNumber} — international item applied`);
            }

            console.log(`✅ All ${boxesCount} international items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 7 — Get Rates
        // ═══════════════════════════════════════════════════════════════
        await test.step('7. Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 8 — Select Rate & Save & Confirm
        //   Prefer "International" in the rate name; fallback to first row.
        // ═══════════════════════════════════════════════════════════════
        await test.step('8. Select Rate and Save & Confirm', async () => {
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('International', 90000);
            await orderToLabelPage.clickSaveAndConfirm();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 9-10 — Get Labels and capture per-box label results
        // ═══════════════════════════════════════════════════════════════
        await test.step('9. Get Labels and capture per-box results', async () => {
            const result = await XenvioWorkflows.getLabelsAndCaptureResult(popupPage, orderToLabelPage, 180000);

            // Soft assertions on captured financial values
            if (result.finalPostage !== null) {
                expect(result.finalPostage, 'finalPostage must be a positive number').toBeGreaterThan(0);
            }
            if (result.shippingCost !== null) {
                expect(result.shippingCost, 'shippingCost must be non-negative').toBeGreaterThanOrEqual(0);
            }

            // Verify we have a label for each box in a multibox order
            expect(result.labelsByBox.length).toBe(boxesCount);
            for (const boxLabel of result.labelsByBox) {
                expect(boxLabel.label, `Box ${boxLabel.boxIndex} must have a valid label URL`).toMatch(/^https?:\/\/.*\.pdf.*/i);
            }

            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    // ─── After-each error capture ────────────────────────────────────────────
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
