import { test, expect } from '../../lib/page-object-fixtures';
import AllureHelper from '../../lib/allure-helper';
import { captureTestFailure } from "../../lib/test-failure-capture";
import { generateUSRecipient, StandardPackage, DefaultReturnLabel } from '../../lib/test-data';
import { XenvioWorkflows } from '../../lib/xenvio-workflows';

/**
 * Xenvio Include Return Label Test Suite
 *
 * End-to-end test que valida el flujo "Include Return Label":
 *   1. Login → 2. Create Order → 3. Search & Open Shipment
 *   4. Add Item Details → 5. Configure Return Label
 *   6. GET RATES → 7. Select Rate & SAVE & CONFIRM → 8. GET LABELS
 *   9. Interceptar task_executor?task=return_label → Validar URLs de ambas etiquetas
 *
 * Reuses all shared workflows from XenvioWorkflows.
 * Network interception validates the API returns both `label` and `returnLabel`.
 */
test.describe('Xenvio Include Return Label Flow', () => {

    test('TC-Xenvio-RL-001: Create order with return label and generate labels', async ({
        xenvioLoginPage,
        xenvioDashboardPage
    }) => {
        const recipient = generateUSRecipient();

        await AllureHelper.applyTestMetadata({
            displayName: `Include Return Label — ${recipient.city}, ${recipient.state}`,
            owner: "QA Automation Team",
            tags: ["xenvio", "return-label", "configure-shipment", "e2e"],
            severity: "critical",
            epic: "Xenvio",
            feature: "Return Label",
            story: "Configure and generate label with return label included",
            parentSuite: "Xenvio Shipment Suite",
            suite: "Return Label Tests",
            subSuite: "Include Return Label"
        });

        const config = {
            url: process.env.XENVIO_URL || 'https://x5demo2.shipedge.com/users/sign_in',
            email: process.env.XENVIO_EMAIL!,
            pass: process.env.XENVIO_PASSWORD!,
            app: process.env.APP_XENVIO!,
            warehouse: process.env.WAREHOUSE_XENVIO!
        };

        console.log(`\n📦 Return Label Test: ${recipient.name} | ${recipient.city}, ${recipient.state} ${recipient.zip}`);

        // ═══════════════════════════════════════════════════════
        // REUSABLE STEPS (from XenvioWorkflows)
        // ═══════════════════════════════════════════════════════

        // Step 1-2: Login and Open Shipper View
        const popupPage = await XenvioWorkflows.loginAndOpenShipperView(xenvioLoginPage, xenvioDashboardPage, config);

        // Step 3: Create New Order
        const shipmentNumber = await XenvioWorkflows.createStandardOrder(popupPage, recipient, StandardPackage, config.warehouse);

        // Step 4: Search and Open O2L Panel
        const orderToLabelPage = await XenvioWorkflows.searchAndOpenShipment(popupPage, shipmentNumber);

        // Step 5: Add Item Details
        await XenvioWorkflows.addItemDetails(orderToLabelPage, {
            ...StandardPackage,
            sku: 'TEST-SKU-RETURN-LABEL',
            country: 'us',
            unitPrice: '1'
        });

        // ═══════════════════════════════════════════════════════
        // RETURN LABEL CONFIGURATION
        // ═══════════════════════════════════════════════════════

        await test.step('6. Configure Return Label', async () => {
            await XenvioWorkflows.configureReturnLabel(orderToLabelPage, DefaultReturnLabel);
        });

        // ═══════════════════════════════════════════════════════
        // FLOW CONTINUATION
        // ═══════════════════════════════════════════════════════

        await test.step('7. Save Package & Get Rates', async () => {
            await orderToLabelPage.clickGetRates();
            await AllureHelper.attachScreenShot(popupPage);
        });

        await test.step('8. Select and Confirm Rate', async () => {
            await orderToLabelPage.ratesModal.changeItemsPerPageTo50();
            await orderToLabelPage.ratesModal.selectRateByText('Ground Advantage');
            await orderToLabelPage.clickSaveAndConfirm();
            // Esperar que desaparezca el loading después de save & confirm
            await orderToLabelPage.waitForXenvioLoading(60000);
            await AllureHelper.attachScreenShot(popupPage);
        });

        // ═══════════════════════════════════════════════════════
        // GET LABELS + INTERCEPT task_executor?task=return_label
        // ═══════════════════════════════════════════════════════

        await test.step('9. Get Labels & Validate Return Label API Response', async () => {

            // ── 1. Preparar interceptor ANTES de hacer clic ─────────────────
            console.log('🔍 Setting up interceptor for task_executor?task=return_label...');

            const returnLabelResponsePromise = popupPage.waitForResponse(
                (response) =>
                    response.url().includes('task_executor') &&
                    response.url().includes('task=return_label') &&
                    response.status() === 200,
                { timeout: 120000 }
            );

            // ── 2. Click GET LABELS ──────────────────────────────────────────
            await orderToLabelPage.clickGetLabels(90000);

            console.log('✅ VOID LABEL button visible — UI ready, awaiting API response...');
            await AllureHelper.attachScreenShot(popupPage);

            // ── 3. Esperar y capturar la respuesta del task_executor ─────────
            const returnLabelResponse = await returnLabelResponsePromise;
            const responseBody = await returnLabelResponse.json();

            console.log('📡 task_executor?task=return_label — response captured');

            // ── 4. Extraer datos del JSON ────────────────────────────────────
            const shipment = responseBody?.shipments?.[0];
            const box      = shipment?.boxes?.[0];

            const forwardLabelUrl: string | null = box?.label       ?? null;
            const returnLabelUrl:  string | null = box?.returnLabel ?? null;

            console.log(`📄 Forward Label : ${forwardLabelUrl}`);
            console.log(`📄 Return Label  : ${returnLabelUrl}`);

            // ── 5. Validaciones ──────────────────────────────────────────────

            expect(
                returnLabelUrl,
                '❌ returnLabel debe estar presente en la respuesta del task_executor'
            ).toBeTruthy();

            expect(
                returnLabelUrl,
                '❌ returnLabel debe apuntar a un archivo .pdf'
            ).toMatch(/\.pdf(\?|$|--)/i);

            expect(
                forwardLabelUrl,
                '❌ label (forward) debe estar presente en la respuesta del task_executor'
            ).toBeTruthy();

            expect(
                shipment?.aasmState,
                '❌ El shipment debe estar en estado "shipped" tras generar etiquetas'
            ).toBe('shipped');

            expect(
                shipment?.isAutoReturnLabel,
                '❌ isAutoReturnLabel debe ser true cuando se configura return label'
            ).toBe(true);

            // ── 6. Adjuntar evidencia en Allure ──────────────────────────────
            const labelSummary = {
                shipmentNumber:    shipment?.shipmentNumber      ?? 'N/A',
                shipmentState:     shipment?.aasmState           ?? 'N/A',
                isAutoReturnLabel: shipment?.isAutoReturnLabel   ?? false,
                trackingNumber:    box?.trackingNumber           ?? 'N/A',
                finalPostage:      shipment?.finalPostage        ?? 0,
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
