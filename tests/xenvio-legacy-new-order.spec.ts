import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import logger from "../lib/logger";

const log = logger({ filename: __filename });

/**
 * Xenvio Legacy New Order Test Suite
 *
 * Creates a new order with a shipment in the legacy ShipEdge Rails UI (x5demo1).
 * Captures and logs the resulting Order ID and Shipment ID.
 */
test.describe('Xenvio Legacy New Order', () => {

    test('TC-Xenvio-Legacy-NewOrder-001: Create new order and shipment in legacy UI', async ({
        page,
        xenvioLoginPage,
        xenvioLegacyNewOrderPage,
        waitForPageLoad,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: 'Create New Order — Legacy ShipEdge UI',
            owner: "QA Automation Team",
            tags: ["xenvio", "legacy", "new-order", "shipment", "regression"],
            severity: "critical",
            epic: "Xenvio Legacy",
            feature: "Orders",
            story: "Create New Order with Shipment",
            parentSuite: "Xenvio Legacy Suite",
            suite: "Order Tests",
            subSuite: "New Order Flow"
        });

        // ── Read config from .env ────────────────────────────────────────────
        const xenvioUrl        = process.env.XENVIO_URL!;
        const xenvioEmail      = process.env.XENVIO_EMAIL!;
        const xenvioPassword   = process.env.XENVIO_PASSWORD!;
        const warehouseId      = process.env.LEGACY_WAREHOUSE_ID   || '141';
        const shipMethodId     = process.env.LEGACY_SHIP_METHOD_ID || '7948';
        const orderNumberBase  = process.env.LEGACY_ORDER_NUMBER   || 'PruebaCarrier';
        const shipmentNumBase  = process.env.LEGACY_SHIPMENT_NUMBER || 'ShipCarrierPrueba';

        // Append timestamp to avoid duplicate order/shipment numbers across runs
        const timestamp       = Date.now();
        const orderNumber     = `${orderNumberBase}_${timestamp}`;
        const shipmentNumber  = `${shipmentNumBase}_${timestamp}`;

        log.info('--- Starting Test: Create Legacy New Order ---', {
            url: xenvioUrl,
            warehouseId,
            shipMethodId,
            orderNumber,
            shipmentNumber,
        });

        // ─── Step 1: Login ───────────────────────────────────────────────────
        await allure.step('1. Login to Xenvio Legacy', async () => {
            log.info('Navigating to login page', { xenvioUrl });
            await xenvioLoginPage.navigateToLogin(xenvioUrl);
            await waitForPageLoad();
            await xenvioLoginPage.login(xenvioEmail, xenvioPassword);
            await waitForPageLoad();
            log.info('Login successful');
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 2: Navigate to Orders ──────────────────────────────────────
        await allure.step('2. Navigate to Orders', async () => {
            await xenvioLegacyNewOrderPage.navigateToOrders();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 3: Click New Order ──────────────────────────────────────────
        await allure.step('3. Click "New order"', async () => {
            await xenvioLegacyNewOrderPage.clickNewOrder();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 4: Fill Order Header ────────────────────────────────────────
        await allure.step('4. Fill order header (Warehouse, Store, Order Number)', async () => {
            await xenvioLegacyNewOrderPage.selectWarehouse(warehouseId);
            await xenvioLegacyNewOrderPage.selectStore(); // picks first available store
            await xenvioLegacyNewOrderPage.fillOrderNumber(orderNumber);
            log.info('Order header filled', { warehouseId, orderNumber });
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 5: Fill Ship-From ───────────────────────────────────────────
        await allure.step('5. Fill ship-from address (Same as warehouse + phone)', async () => {
            await xenvioLegacyNewOrderPage.clickSameAsWarehouse();
            await xenvioLegacyNewOrderPage.fillShipFromPhone('1234567890');
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 6: Create Order (first time) ───────────────────────────────
        await allure.step('6. Click "Create Order" (initial submission)', async () => {
            await xenvioLegacyNewOrderPage.clickCreateOrder();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 7: Fill Recipient Name ──────────────────────────────────────
        await allure.step('7. Fill recipient name', async () => {
            await xenvioLegacyNewOrderPage.fillRecipientName('Dilan');
            log.info('Recipient name filled');
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 8: Create Order (second time — name validation) ─────────────
        await allure.step('8. Click "Create Order" (with recipient name)', async () => {
            await xenvioLegacyNewOrderPage.clickCreateOrder();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 9: Fill Shipment Info ───────────────────────────────────────
        await allure.step('9. Fill shipment number and select shipping method', async () => {
            await xenvioLegacyNewOrderPage.fillShipmentNumber(shipmentNumber);
            await xenvioLegacyNewOrderPage.selectShipMethod(shipMethodId);
            log.info('Shipment info filled', { shipmentNumber, shipMethodId });
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 10: Fill Ship-To Address ────────────────────────────────────
        await allure.step('10. Fill ship-to address', async () => {
            await xenvioLegacyNewOrderPage.fillShipToAddress({
                address1: '20 W 34th St',
                zip:      '10001',
                state:    'NY',
                city:     'New York',
                company:  'ComanyCarrierPrueba',
                name:     'PowerShip',
                phone:    '1234567890',
                email:    'prueba@yopmail.com',
            });
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 11: Create Shipment ─────────────────────────────────────────
        await allure.step('11. Click "Create Shipment"', async () => {
            await xenvioLegacyNewOrderPage.clickCreateShipment();
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Step 12: Capture Order ID ────────────────────────────────────────
        let capturedOrderId: string | null = null;
        let capturedShipmentId: string | null = null;

        await allure.step('12. Capture Order ID and Shipment ID', async () => {
            // Give the page a moment to fully render the confirmation data
            await page.waitForTimeout(1500);

            capturedOrderId    = await xenvioLegacyNewOrderPage.captureOrderId();
            capturedShipmentId = await xenvioLegacyNewOrderPage.captureShipmentId();

            // ── Print to console ─────────────────────────────────────────────
            console.log('');
            console.log('╔══════════════════════════════════════╗');
            console.log('║   📦 LEGACY ORDER CREATION RESULT   ║');
            console.log('╠══════════════════════════════════════╣');
            console.log(`║  ✅ Order ID   : ${capturedOrderId ?? 'NOT FOUND'}`);
            console.log(`║  ✅ Shipment ID: ${capturedShipmentId ?? 'NOT FOUND'}`);
            console.log('╚══════════════════════════════════════╝');
            console.log('');

            // ── Attach to Allure ─────────────────────────────────────────────
            if (capturedOrderId) {
                await allure.attachment('Order ID', capturedOrderId, 'text/plain');
            }
            if (capturedShipmentId) {
                await allure.attachment('Shipment ID', capturedShipmentId, 'text/plain');
            }

            log.info('IDs captured', { orderId: capturedOrderId, shipmentId: capturedShipmentId });
            await AllureHelper.attachScreenShot(page);
        });

        // ─── Assertions ───────────────────────────────────────────────────────
        expect(capturedOrderId,    'Order ID should be captured from the page').not.toBeNull();
        expect(capturedShipmentId, 'Shipment ID should be captured from the page').not.toBeNull();

        log.info('--- Test Completed Successfully ---', {
            orderId:    capturedOrderId,
            shipmentId: capturedShipmentId,
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
