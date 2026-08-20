import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from '../../lib/test-failure-capture';
import { generateUSRecipient, StandardPackage, DefaultReturnLabel } from '../../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

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

            // ── Setup browser-side fetch interceptor to capture ALL task_executor responses ──
            console.log('🔍 Setting up browser-side fetch interceptor for task_executor responses...');

            let mainLabelBody: any = null;
            let returnLabelBody: any = null;
            let returnLabelError: any = null;

            // Inject fetch monkey-patch — captures responses in the browser's JS heap
            await popupPage.evaluate(() => {
                const origFetch = window.fetch;
                (window as any).__origFetchRL = origFetch;
                (window as any).__capturedMainLabel = null;
                (window as any).__capturedReturnLabel = null;
                (window as any).__capturedReturnLabelError = null;
                window.fetch = async function (...args: any[]) {
                    const response = await origFetch.apply(this, args as any);
                    try {
                        const url = (args[0] instanceof Request ? args[0].url : String(args[0])) || '';
                        if (url.includes('task_executor') && response.ok) {
                            const clone = response.clone();
                            const body = await clone.json();
                            if (url.includes('task=return_label')) {
                                if (body?.error) {
                                    (window as any).__capturedReturnLabelError = body.error;
                                } else {
                                    (window as any).__capturedReturnLabel = body;
                                }
                            } else if (!(window as any).__capturedMainLabel) {
                                (window as any).__capturedMainLabel = body;
                            }
                        }
                    } catch { /* ignore */ }
                    return response;
                };
            });

            try {
                // ── Click GET LABELS ──
                await orderToLabelPage.clickGetLabels(90000);
                console.log('✅ GET LABELS completed');
                await AllureHelper.attachScreenShot(popupPage);

                // Poll for return label response (auto-call after main label)
                console.log('⏳ Waiting for automatic return_label call...');
                const pollStart = Date.now();
                while (Date.now() - pollStart < 30000) {
                    const captured = await popupPage.evaluate(() => ({
                        main: (window as any).__capturedMainLabel,
                        returnLabel: (window as any).__capturedReturnLabel,
                        returnError: (window as any).__capturedReturnLabelError,
                    }));
                    mainLabelBody = captured.main;
                    returnLabelBody = captured.returnLabel;
                    returnLabelError = captured.returnError;

                    if (returnLabelBody || returnLabelError) {
                        if (returnLabelBody) console.log('📡 task_executor?task=return_label — captured successfully');
                        if (returnLabelError) console.warn(`⚠️ Return label API error: ${JSON.stringify(returnLabelError)}`);
                        break;
                    }
                    await popupPage.waitForTimeout(1000);
                }

                if (mainLabelBody) console.log('📡 task_executor (main label) — captured');

                // ── If return label failed with error 1008, retry with button ──
                if (returnLabelError && !returnLabelBody) {
                    console.warn(`⚠️ Return label creation failed (code: ${returnLabelError.code || 'unknown'})`);
                    console.log('🔄 Retrying via "GET RETURN LABEL" button...');

                    await popupPage.waitForTimeout(2000);
                    const getReturnBtn = popupPage.locator('p-button').filter({ hasText: /GET RETURN LABEL/i }).first();

                    if (await getReturnBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
                        // Reset captured data for retry
                        await popupPage.evaluate(() => {
                            (window as any).__capturedReturnLabel = null;
                            (window as any).__capturedReturnLabelError = null;
                        });

                        await getReturnBtn.click();
                        console.log('✅ "GET RETURN LABEL" clicked');

                        await orderToLabelPage.waitForXenvioLoading(60000);

                        // Poll for retry response
                        const retryStart = Date.now();
                        while (Date.now() - retryStart < 60000) {
                            const retry = await popupPage.evaluate(() => ({
                                returnLabel: (window as any).__capturedReturnLabel,
                                returnError: (window as any).__capturedReturnLabelError,
                            }));
                            if (retry.returnLabel) {
                                returnLabelBody = retry.returnLabel;
                                returnLabelError = null;
                                console.log('📡 Return label retry — captured successfully');
                                break;
                            }
                            if (retry.returnError) {
                                returnLabelError = retry.returnError;
                                console.error(`❌ Return label retry also failed: ${JSON.stringify(retry.returnError)}`);
                                break;
                            }
                            await popupPage.waitForTimeout(1000);
                        }
                    } else {
                        console.warn('⚠️ "GET RETURN LABEL" button not visible — cannot retry');
                    }
                }
            } finally {
                // Restore original fetch
                await popupPage.evaluate(() => {
                    if ((window as any).__origFetchRL) {
                        window.fetch = (window as any).__origFetchRL;
                    }
                    delete (window as any).__capturedMainLabel;
                    delete (window as any).__capturedReturnLabel;
                    delete (window as any).__capturedReturnLabelError;
                    delete (window as any).__origFetchRL;
                }).catch(() => { /* page might be closed */ });
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
