import { test, expect } from '../lib-v2/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from '../lib/test-failure-capture';
import { generateUSRecipient, StandardPackage, DefaultReturnLabel } from '../lib/test-data';
import { XenvioWorkflows } from '../lib-v2/xenvio-workflows';

/**
 * ─── Xenvio Include Return Label Flow (v2 — PrimeNG) ─────────────────────────
 *
 * Test: TC-Xenvio-RL-001 — Create order with return label and generate labels.
 *
 * Flow:
 *  1. Login → Open Shipper View
 *  2. Create Order → Wait for detail
 *  3. Add Item Details
 *  4. Configure Return Label (via Configure Shipment panel)
 *  5. GET RATES → Select first rate → SAVE & CONFIRM
 *  6. GET LABELS → Intercept task_executor?task=return_label → Validate both labels
 */
test.describe('Xenvio Include Return Label (v2 PrimeNG)', () => {

    test('TC-Xenvio-RL-001: Create order with return label and generate labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage,
    }) => {
        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: `Include Return Label v2 — ${recipient.city}, ${recipient.state}`,
            owner:    'QA Automation Team',
            tags:     ['xenvio', 'return-label', 'configure-shipment', 'e2e', 'v2', 'primeng'],
            severity: 'critical',
            epic:     'Xenvio',
            feature:  'Return Label (v2 PrimeNG)',
            story:    'Configure and generate label with return label included',
        });

        const config = {
            url:       process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email:     process.env.XENVIO_EMAIL!,
            pass:      process.env.XENVIO_PASSWORD!,
            app:       process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!,
        };

        console.log(`\n📦 Return Label Test (v2 PrimeNG): ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 1-2 — Login and Open Shipper View
        // ═════════════════════════════════════════════════════════════════════
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(
            xenvioLoginPage,
            xenvioDashboardPage,
            config,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 3 — Create New Order
        // ═════════════════════════════════════════════════════════════════════
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(
            popupPage,
            recipient,
            StandardPackage,
            config.warehouse,
        );

        console.log(`✅ Order created — Shipment: ${shipmentNumber}`);

        // ═════════════════════════════════════════════════════════════════════
        // STEP 4 — Wait for shipment detail (system auto-redirects)
        // ═════════════════════════════════════════════════════════════════════
        const orderToLabelPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(
            popupPage,
            shipmentNumber,
        );

        // ═════════════════════════════════════════════════════════════════════
        // STEP 5 — Add Item Details
        // ═════════════════════════════════════════════════════════════════════
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku:       'TEST-SKU-RETURN-LABEL',
            country:   'us',
            unitPrice: '1',
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 6 — Configure Return Label
        // ═════════════════════════════════════════════════════════════════════
        await test.step('6. Configure Return Label', async () => {
            await XenvioWorkflows.configureReturnLabel(orderToLabelPage, DefaultReturnLabel);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 7 — Get Rates
        // ═════════════════════════════════════════════════════════════════════
        await test.step('7. Save Package & Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 8 — Select Rate & Save + Confirm
        // ═════════════════════════════════════════════════════════════════════
        await test.step('8. Select and Confirm Rate', async () => {
            const selectedLabel = await orderToLabelPage.ratesModal.selectFirstRate(60000);
            console.log(`  ℹ️ Rate selected: ${selectedLabel}`);
            await orderToLabelPage.clickSaveAndConfirm();
            await orderToLabelPage.waitForXenvioLoading(60000);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═════════════════════════════════════════════════════════════════════
        // STEP 9 — Get Labels & Validate Return Label API Response
        // ═════════════════════════════════════════════════════════════════════
        await test.step('9. Get Labels & Validate Return Label API Response', async () => {

            // 1. Setup interceptor BEFORE clicking GET LABELS
            console.log('🔍 Setting up interceptor for task_executor?task=return_label...');

            const returnLabelResponsePromise = popupPage.waitForResponse(
                (response) =>
                    response.url().includes('task_executor') &&
                    response.url().includes('task=return_label') &&
                    response.status() === 200,
                { timeout: 120000 }
            );

            // 2. Click GET LABELS
            await orderToLabelPage.clickGetLabels(90000);

            console.log('✅ VOID LABEL button visible — UI ready, awaiting API response...');
            await AllureHelper.attachScreenShot(popupPage);

            // 3. Capture and parse the API response
            const returnLabelResponse = await returnLabelResponsePromise;
            const responseBody = await returnLabelResponse.json();

            console.log('📡 task_executor?task=return_label — response captured');

            // 4. Extract data
            const shipment = responseBody?.shipments?.[0];
            const box      = shipment?.boxes?.[0];

            const forwardLabelUrl: string | null = box?.label       ?? null;
            const returnLabelUrl:  string | null = box?.returnLabel ?? null;

            console.log(`📄 Forward Label : ${forwardLabelUrl}`);
            console.log(`📄 Return Label  : ${returnLabelUrl}`);

            // 5. Validations
            expect(
                returnLabelUrl,
                '❌ returnLabel must be present in the task_executor response'
            ).toBeTruthy();

            expect(
                returnLabelUrl,
                '❌ returnLabel must point to a .pdf file'
            ).toMatch(/\.pdf(\?|$|--)/i);

            expect(
                forwardLabelUrl,
                '❌ label (forward) must be present in the task_executor response'
            ).toBeTruthy();

            expect(
                shipment?.aasmState,
                '❌ Shipment must be in "shipped" state after generating labels'
            ).toBe('shipped');

            expect(
                shipment?.isAutoReturnLabel,
                '❌ isAutoReturnLabel must be true when return label is configured'
            ).toBe(true);

            // 6. Attach evidence to Allure
            const labelSummary = {
                shipmentNumber:    shipment?.shipmentNumber    ?? 'N/A',
                shipmentState:     shipment?.aasmState         ?? 'N/A',
                isAutoReturnLabel: shipment?.isAutoReturnLabel ?? false,
                trackingNumber:    box?.trackingNumber         ?? 'N/A',
                finalPostage:      shipment?.finalPostage      ?? 0,
                forwardLabel:      forwardLabelUrl,
                returnLabel:       returnLabelUrl,
            };

            await AllureHelper.attachJSON(popupPage, 'Return Label API Response', labelSummary);

            console.log('');
            console.log('════════════════════════════════════════════');
            console.log('✅  RETURN LABEL VALIDATION PASSED');
            console.log(`    Shipment  : ${labelSummary.shipmentNumber}`);
            console.log(`    State     : ${labelSummary.shipmentState}`);
            console.log(`    Tracking  : ${labelSummary.trackingNumber}`);
            console.log(`    Postage   : $${labelSummary.finalPostage}`);
            console.log(`    Auto RL   : ${labelSummary.isAutoReturnLabel}`);
            console.log('════════════════════════════════════════════');
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
