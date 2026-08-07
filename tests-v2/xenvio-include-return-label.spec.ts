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

            // ── Setup event listeners to capture ALL task_executor responses ──
            console.log('🔍 Setting up event listeners for task_executor responses...');

            let mainLabelBody: any = null;
            let returnLabelBody: any = null;
            let returnLabelError: any = null;
            let mainResolve: () => void;
            let returnResolve: () => void;
            const mainPromise = new Promise<void>((r) => { mainResolve = r; });
            const returnPromise = new Promise<void>((r) => { returnResolve = r; });

            const responseHandler = async (response: import('@playwright/test').Response) => {
                try {
                    const url = response.url();
                    if (!url.includes('task_executor')) return;

                    const body = await response.body();
                    const parsed = JSON.parse(body.toString());

                    if (url.includes('task=return_label')) {
                        // Check if it's an error response
                        if (parsed?.error) {
                            returnLabelError = parsed.error;
                            console.warn(`⚠️ Return label API error: ${JSON.stringify(parsed.error)}`);
                            returnResolve();
                        } else {
                            returnLabelBody = parsed;
                            console.log('📡 task_executor?task=return_label — captured successfully');
                            returnResolve();
                        }
                    } else if (response.status() === 200 && !mainLabelBody) {
                        mainLabelBody = parsed;
                        console.log('📡 task_executor (main label) — captured');
                        mainResolve();
                    }
                } catch (err) {
                    // Silently ignore parse errors for non-matching responses
                }
            };

            popupPage.on('response', responseHandler);

            try {
                // ── Click GET LABELS ──
                await orderToLabelPage.clickGetLabels(90000);
                console.log('✅ GET LABELS completed');
                await AllureHelper.attachScreenShot(popupPage);

                // Wait for the return label auto-call (happens after main label succeeds)
                console.log('⏳ Waiting for automatic return_label call...');
                await Promise.race([
                    returnPromise,
                    popupPage.waitForTimeout(30000)
                ]);

                // ── If return label failed with error 1008, retry with button ──
                if (returnLabelError && !returnLabelBody) {
                    console.warn(`⚠️ Return label creation failed (code: ${returnLabelError.code || 'unknown'})`);
                    console.log('🔄 Retrying via "GET RETURN LABEL" button...');

                    // Wait for button to appear
                    await popupPage.waitForTimeout(2000);
                    const getReturnBtn = popupPage.locator('p-button').filter({ hasText: /GET RETURN LABEL/i }).first();

                    if (await getReturnBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
                        // Reset for retry
                        returnLabelBody = null;
                        returnLabelError = null;
                        const retryPromise = new Promise<void>((r) => { returnResolve = r; });

                        await getReturnBtn.click();
                        console.log('✅ "GET RETURN LABEL" clicked');

                        // Wait for the loading to finish
                        await orderToLabelPage.waitForXenvioLoading(60000);

                        // Wait for the retry response
                        await Promise.race([
                            retryPromise,
                            popupPage.waitForTimeout(60000)
                        ]);

                        if (returnLabelError && !returnLabelBody) {
                            console.error(`❌ Return label retry also failed: ${JSON.stringify(returnLabelError)}`);
                        }
                    } else {
                        console.warn('⚠️ "GET RETURN LABEL" button not visible — cannot retry');
                    }
                }
            } finally {
                popupPage.removeListener('response', responseHandler);
            }

            // ── Use whichever response has the return label data ──
            const responseBody = returnLabelBody || mainLabelBody;

            if (!responseBody) {
                console.error('❌ No task_executor response captured');
                throw new Error('Failed to capture any task_executor response');
            }

            console.log('📡 Final response captured — extracting return label data...');

            // ── Extract data ──
            const shipment = responseBody?.shipments?.[0];
            const box      = shipment?.boxes?.[0];

            const forwardLabelUrl: string | null = box?.label       ?? null;
            const returnLabelUrl:  string | null = box?.returnLabel ?? null;

            console.log(`📄 Forward Label : ${forwardLabelUrl}`);
            console.log(`📄 Return Label  : ${returnLabelUrl}`);

            // ── Validations ──
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

            // ── Attach evidence to Allure ──
            const labelSummary = {
                shipmentNumber:    shipment?.shipmentNumber    ?? 'N/A',
                shipmentState:     shipment?.aasmState         ?? 'N/A',
                isAutoReturnLabel: shipment?.isAutoReturnLabel ?? false,
                trackingNumber:    box?.trackingNumber         ?? 'N/A',
                finalPostage:      shipment?.finalPostage      ?? 0,
                forwardLabel:      forwardLabelUrl,
                returnLabel:       returnLabelUrl,
                retriedReturnLabel: !!returnLabelError,
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
            if (labelSummary.retriedReturnLabel) {
                console.log(`    ⚠️ Return label required retry (initial error 1008)`);
            }
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
