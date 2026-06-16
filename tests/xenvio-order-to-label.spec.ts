import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio Order-to-Label Test Suite (Refactored for Reusability)
 */
test.describe('Xenvio Order-to-Label Flow', () => {

    const ordersToCreate = parseInt(process.env.ORDERS_TO_CREATE ?? '1', 10);
    const useBatchMode = process.env.BATCH_MODE === 'true';

    if (useBatchMode) {
        test(`TC-Xenvio-O2L-Batch: Create and label ${ordersToCreate} orders in a single session`, async ({
            xenvioLoginPage,
            xenvioDashboardPage
        }) => {
            // Set dynamic timeout: 2 minutes (120,000 ms) per order to create
            test.setTimeout(ordersToCreate * 120 * 1000);

            const config = {
                url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
                email: process.env.XENVIO_EMAIL!,
                pass: process.env.XENVIO_PASSWORD!,
                app: process.env.APP_XENVIO!,
                warehouse: process.env.WAREHOUSE_XENVIO!
            };

            console.log(`\n🚀 Starting Batch Generation of ${ordersToCreate} labeled orders...`);
            
            // Login and open shipper view ONCE
            let popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

            for (let orderIndex = 1; orderIndex <= ordersToCreate; orderIndex++) {
                // Ensure we are logged in and on the correct page (recover session if logged out or redirected)
                if (popupPage.isClosed() || !popupPage.url().includes('shipper-view')) {
                    console.log('\n⚠️ Session lost or redirected. Re-logging in to restore session...');
                    try {
                        popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);
                    } catch (loginErr) {
                        console.error('❌ Failed to restore session:', loginErr);
                        continue; // Try next iteration (it will try to login again)
                    }
                }

                const recipient = generateUSRecipient();
                console.log(`\n📦 [Batch] Order ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state}`);

                try {
                    // Create New Order
                    const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

                    // Search and Open O2L Panel
                    const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

                    // Add Item Details
                    await XenvioWorkflows.addItemDetails(orderToLabelPage, {
                        ...StandardPackage,
                        sku: `BATCH-SKU-${orderIndex}`,
                        country: 'us',
                        unitPrice: '1'
                    });

                    // Save Package & Get Rates
                    await test.step(`Order ${orderIndex}: Get Rates`, async () => {
                        await orderToLabelPage.clickGetRates();
                    });

                    // Select and Confirm Rate
                    await test.step(`Order ${orderIndex}: Select Rate`, async () => {
                        await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
                        await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
                        await orderToLabelPage.clickSaveAndConfirm();
                    });

                    // Get Labels
                    await test.step(`Order ${orderIndex}: Get Labels`, async () => {
                        await orderToLabelPage.clickGetLabels(90000);
                        console.log(`✅ Label successfully generated for shipment ${shipmentNumber}`);
                    });
                } catch (error) {
                    console.error(`❌ Error processing order ${orderIndex}/${ordersToCreate}:`, error);
                    
                    try {
                        if (!popupPage.isClosed()) {
                            const currentUrl = popupPage.url();
                            if (currentUrl.includes('shipper-view')) {
                                // Navigate to the base shipper-view page to clear panels/modals
                                const baseUrl = currentUrl.split('?')[0];
                                console.log(`🔄 Cleaning up state. Navigating back to dashboard: ${baseUrl}`);
                                await popupPage.goto(baseUrl);
                                await popupPage.waitForLoadState('networkidle');
                            } else {
                                console.log('🔄 Reloading page...');
                                await popupPage.reload();
                                await popupPage.waitForLoadState('networkidle');
                            }
                        }
                    } catch (cleanUpErr) {
                        console.error('⚠️ Cleanup failed:', cleanUpErr);
                    }
                }
            }
        });
    } else {
        for (let i = 0; i < ordersToCreate; i++) {
            const orderIndex = i + 1;

            test(`TC-Xenvio-O2L-${String(orderIndex).padStart(3, '0')}: Create order and get label #${orderIndex}`, async ({
                xenvioLoginPage,
                xenvioDashboardPage
            }) => {
                const recipient = generateUSRecipient();

                await AllureHelper.applyTestMetadata({
                    displayName: `Order-to-Label #${orderIndex} — ${recipient.city}, ${recipient.state}`,
                    owner: "QA Automation Team",
                    tags: ["xenvio", "order-to-label", "o2l", "e2e"],
                    severity: "critical",
                    epic: "Xenvio",
                    feature: "Order-to-Label",
                    story: `Generate label for order #${orderIndex}`
                });

                const config = {
                    url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
                    email: process.env.XENVIO_EMAIL!,
                    pass: process.env.XENVIO_PASSWORD!,
                    app: process.env.APP_XENVIO!,
                    warehouse: process.env.WAREHOUSE_XENVIO!
                };

                console.log(`\n🎲 Rate request ${orderIndex}/${ordersToCreate}: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

                // REUSE: Login and Open Shipper View
                const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

                // REUSE: Create New Order
                const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

                // REUSE: Search and Open O2L Panel
                const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

                // REUSE: Add Item Details
                await XenvioWorkflows.addItemDetails(orderToLabelPage, {
                    ...StandardPackage,
                    sku: 'TEST-SKU-1',
                    country: 'us',
                    unitPrice: '1'
                });

                // ═══════════════════════════════════════════════════════
                // FLOW CONTINUATION (Specific to Labeling)
                // ═══════════════════════════════════════════════════════

                await test.step('6. Save Package & Get Rates', async () => {
                    await orderToLabelPage.clickGetRates();
                    await AllureHelper.attachScreenShot(popupPage);
                });

                await test.step('7. Select and Confirm Rate', async () => {
                    await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
                    await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
                    await orderToLabelPage.clickSaveAndConfirm();
                    await AllureHelper.attachScreenShot(popupPage);
                });

                await test.step('8. Get Labels', async () => {
                    await orderToLabelPage.clickGetLabels(90000);
                    
                    console.log(`✅ Labels successfully generated for order ${orderIndex}/${ordersToCreate}!`);
                    await AllureHelper.attachScreenShot(popupPage);
                });
            });
        }
    }

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
