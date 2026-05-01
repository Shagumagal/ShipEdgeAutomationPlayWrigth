import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage } from '../lib/test-data';
import { XenvioWorkflows } from '../lib/xenvio-workflows';

/**
 * Xenvio Order-to-Label Multi-Box Test Suite
 */
test.describe('Xenvio Order-to-Label Multi-Box Flow', () => {

    test('TC-Xenvio-O2L-MultiBox: Create order with 10 boxes and get labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient = generateUSRecipient();
        const boxesCount = 10;

        await AllureHelper.applyTestMetadata({
            displayName: `Order-to-Label Multi-Box (10) — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "order-to-label", "o2l", "multibox", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Order-to-Label",
            story: `Generate label for multi-box order (10 boxes)`
        });

        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n📦 Multi-Box Process: 10 Boxes | ${recipient.name} | ${recipient.city}, ${recipient.state}`);

        // REUSE: Login and Open Shipper View
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // REUSE: Create New Order
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // REUSE: Search and Open O2L Panel
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // ── Step 5a: Create all boxes first (Specific to Multi-Box) ──
        await test.step(`5a. Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`, async () => {
            for (let i = 2; i <= boxesCount; i++) {
                console.log(`  📦 Creating Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddBox();
                await orderToLabelPage.boxForm.fillBoxForm(`${i}`, '5', '10', '8', '6');
                await orderToLabelPage.boxForm.clickApplyBox();
            }
            console.log(`✅ All ${boxesCount} boxes created`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ── Step 5b: Add items to each box (Specific to Multi-Box) ──
        await test.step(`5b. Add Items to all ${boxesCount} Boxes (SKU 1-${boxesCount})`, async () => {
            for (let i = 1; i <= boxesCount; i++) {
                console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);
                await orderToLabelPage.boxForm.clickAddItemForBox(i - 1);
                await orderToLabelPage.boxForm.fillItemDetails({
                    sku: `${i}`,
                    weight: StandardPackage.weight,
                    length: StandardPackage.length,
                    width: StandardPackage.width,
                    height: StandardPackage.height,
                    country: 'us',
                    unitPrice: '1',
                    qty: StandardPackage.qty
                });
                await orderToLabelPage.boxForm.clickApplyItem();
            }
            console.log(`✅ All ${boxesCount} items added`);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // FINAL PHASE (Standard Logic)
        // ═══════════════════════════════════════════════════════

        await test.step('6. Get Rates', async () => {
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
            // Generar etiquetas para 10 cajas toma más tiempo, enviamos un timeout mayor
            await orderToLabelPage.clickGetLabels(90000);
            
            // Usar 'toHaveURL' en lugar de un 'expect' estático para que espere si es necesario
            await expect(popupPage).toHaveURL(/.*shipper-view.*/, { timeout: 30000 });
            
            // Esperar a que desaparezca el logo de Xenvio y se muestre la vista final con el botón VOID LABEL
            await popupPage.getByRole('button', { name: /VOID LABEL/i }).waitFor({ state: 'visible', timeout: 90000 });
            
            console.log(`✅ Multi-box labels successfully generated!`);
            await AllureHelper.attachScreenShot(popupPage);
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
