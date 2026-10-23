import { test, expect } from '@playwright/test';
import {
    buildApiOrderPayload,
    generateApiOrderNumbers,
    parseApiOrderResponse,
    type ApiOrderCommand,
} from '../domain/orders/api-order';
import { shipperViewUrl } from '../domain/shipments/shipper-view-link';
import { loadXenvioApiConfig } from '../config/xenvio-config';
import { ApiOrderService } from '../services/api-order-service';
import { CustomsData, CustomsPackagePlan, InternationalSettingsScenarios, OrderBuilder, UsMerchant } from '../test-data';

function command(overrides: Partial<ApiOrderCommand> = {}): ApiOrderCommand {
    const order = OrderBuilder.domestic().build();
    return {
        recipient: order.recipient,
        plan: { box: order.product, item: order.item },
        warehouse: 'qa20',
        shipCode: 'EFEXG',
        createLabel: true,
        orderNumber: 'QA-API-1',
        shipmentNumber: 'QA-API-1-S1',
        ...overrides,
    };
}

/** What the test sent: the answer must be about this order. */
const SENT = { orderNumber: 'QA-API-1', shipmentNumber: 'QA-API-1-S1', createLabel: true };

function shippedResponse(shipment: Record<string, unknown> = {}) {
    return {
        orders: [{
            status: 'Success',
            order_number: 'QA-API-1',
            shipments: [{
                shipment_number: 'QA-API-1-S1',
                status: 'shipped',
                final_postage: '8.34',
                errors: [null],
                boxes: [{ tracking_number: '7701', packing_slip: { file: 'JVBERi0x'.repeat(500) } }],
                ...shipment,
            }],
        }],
    };
}

test.describe('API v3 order payload', { tag: ['@unit', '@orders'] }, () => {

    test('maps the order builder data to one shipment with one box and numeric values', () => {
        const input = command();
        const [order] = buildApiOrderPayload(input).orders;
        const [shipment] = order.shipments;

        expect(order).toMatchObject({ order_number: 'QA-API-1', warehouse: 'qa20' });
        expect(shipment).toMatchObject({
            shipment_number: 'QA-API-1-S1',
            shipping_method_code: 'EFEXG',
            create_label: true,
            customer: { name: input.recipient.name, zip: input.recipient.zip, country: input.recipient.country },
        });
        expect(shipment.boxes[0].weight).toBe(Number(input.plan.box.weight));
        expect(shipment.boxes[0].items[0]).toMatchObject({
            sku: input.plan.item.sku,
            quantity: Number(input.plan.item.qty),
            sold_price: Number(input.plan.item.unitPrice),
        });
    });

    test('the sender uses the warehouse address but sends its own phone (FedEx requires it)', () => {
        const [order] = buildApiOrderPayload(command()).orders;
        expect(order.merchant.address1).toBe('');
        expect(order.merchant.country).toBe('US');
        expect(order.merchant.phone).toMatch(/^\d{10}$/);
    });

    test('order numbers are recognizable, unique per random draw and never end with "_" (API rule)', () => {
        const now = new Date(2026, 9, 12, 17, 5, 3);
        const first = generateApiOrderNumbers(now, () => 0.123456789);
        const second = generateApiOrderNumbers(now, () => 0.987654321);

        expect(first).toEqual({ orderNumber: 'QA-API-20261012-170503-4fzz', shipmentNumber: 'QA-API-20261012-170503-4fzz-S1' });
        expect(first.orderNumber).not.toBe(second.orderNumber);
    });
});

test.describe('API v3 international order payload', { tag: ['@unit', '@orders'] }, () => {

    const international = (overrides: Partial<ApiOrderCommand> = {}) => command({
        recipient: InternationalSettingsScenarios[0].recipient,
        plan: CustomsPackagePlan,
        shipCode: 'EUSPMI',
        createLabel: false,
        merchant: UsMerchant,
        customs: CustomsData,
        sampleLabel: true,
        ...overrides,
    });

    test('sends the sender, the currency and the customs data of the item', () => {
        const [order] = buildApiOrderPayload(international()).orders;
        const [shipment] = order.shipments;

        expect(order).toMatchObject({ currency: 'USD', merchant: { address1: '106 Capitola Dr', zip: '27713', country: 'US' } });
        expect(shipment).toMatchObject({ create_label: false, sample_label: true, shipping_method_code: 'EUSPMI' });
        expect(shipment.boxes[0]).toMatchObject({ category: 'merchandise' });
        expect(shipment.boxes[0].items[0]).toMatchObject({
            sku: 'QA-INTL-HS-1', description: 'QA customs item', harmonization: '1234567890', country: 'US', quantity: 2, sold_price: 1,
        });
    });

    test('a domestic order sends none of it', () => {
        const [order] = buildApiOrderPayload(international({ merchant: undefined, customs: undefined, sampleLabel: undefined })).orders;
        const [shipment] = order.shipments;

        expect(order).not.toHaveProperty('currency');
        expect(order.merchant.address1).toBe('');
        expect(shipment).not.toHaveProperty('sample_label');
        expect(shipment.boxes[0]).not.toHaveProperty('category');
        expect(shipment.boxes[0].items[0]).not.toHaveProperty('harmonization');
    });
});

test.describe('API v3 order response', { tag: ['@unit', '@orders'] }, () => {

    test('an answer about another order fails, even if it says Success', () => {
        const response = shippedResponse({ shipment_number: 'QA-API-OTHER-S1' });
        expect(() => parseApiOrderResponse(response, SENT)).toThrow(/answered for another order: expected QA-API-1 \/ QA-API-1-S1, got QA-API-1 \/ QA-API-OTHER-S1/);
        expect(() => parseApiOrderResponse({ orders: [{ status: 'Success', shipments: [] }] }, SENT)).toThrow(/got none \/ none/);
    });

    test('a shipped order returns its numbers, state, postage and tracking', () => {
        expect(parseApiOrderResponse(shippedResponse(), SENT)).toEqual({
            orderNumber: 'QA-API-1',
            shipmentNumber: 'QA-API-1-S1',
            shipmentState: 'shipped',
            finalPostage: 8.34,
            trackingNumbers: ['7701'],
        });
    });

    test('validation errors come back as a list and fail with the API message', () => {
        const rejected = [{ order_number: 'QA-API-1', status: 'Bad Request', code: 400, errors: ["Shipping method doesn't exist"] }];
        expect(() => parseApiOrderResponse(rejected, SENT)).toThrow(/rejected the order.*Shipping method doesn't exist/);
        expect(() => parseApiOrderResponse({ error: 'orders is missing' }, SENT)).toThrow(/orders is missing/);
    });

    test('a label the carrier refused fails with the carrier message', () => {
        const response = shippedResponse({
            status: 'in_queue',
            errors: ['{"error":"Carrier error message: PHONENUMBER.EMPTY: Phone number is empty."}'],
        });
        expect(() => parseApiOrderResponse(response, SENT)).toThrow(/shipment failed: .*PHONENUMBER\.EMPTY/);
    });

    test('error messages stay short (the body carries base64 labels and packing slips)', () => {
        const response = shippedResponse({ status: 'in_queue', errors: ['x'.repeat(5000)] });
        expect(() => parseApiOrderResponse(response, SENT)).toThrow(/^.{0,400}$/s);
    });

    test('an order expected shipped without tracking fails', () => {
        const response = shippedResponse({ status: 'pending', boxes: [{ tracking_number: '' }] });
        expect(() => parseApiOrderResponse(response, SENT)).toThrow(/did not ship the order \(state: pending/);
        expect(parseApiOrderResponse(response, { ...SENT, createLabel: false }).shipmentState).toBe('pending');
    });
});

test.describe('Shipper view URL', { tag: ['@unit', '@shipments'] }, () => {

    test('opens a shipment by number, warehouse and app', () => {
        expect(shipperViewUrl('https://x5demo1angular.shipedge.com', {
            shipmentNumber: 'QA-API-1-S1',
            warehouseId: 141,
            appId: 0,
        })).toBe('https://x5demo1angular.shipedge.com/shipper-view?shipment_number=QA-API-1-S1&warehouse_id=141&app_id=0');
    });
});

test.describe('API v3 credentials and default ship code', { tag: ['@unit', '@config', '@orders'] }, () => {

    const CREDENTIALS = { XENVIO_URL: 'https://x52.shipedge.com/users/sign_in', XENVIO_EMAIL: 'qa@send.com', XENVIO_API_TOKEN: 'token' };

    /** Records the payloads it receives; answers like QA for an open order. */
    function fakeOrdersApi() {
        const sent: any[] = [];
        return {
            sent,
            api: {
                createOrder: async (payload: any) => {
                    sent.push(payload);
                    const [order] = payload.orders;
                    return { orders: [{ status: 'Success', order_number: order.order_number, shipments: [{ shipment_number: order.shipments[0].shipment_number, status: 'pending', errors: [] }] }] };
                },
                findWarehouseId: async () => 334,
            },
        };
    }

    test('the credentials are enough: API_ORDER_SHIP_CODE is optional', () => {
        expect(loadXenvioApiConfig(CREDENTIALS)).toMatchObject({ token: 'token', shipCode: null });
        expect(loadXenvioApiConfig({ ...CREDENTIALS, API_ORDER_SHIP_CODE: ' EFEX21 ' }).shipCode).toBe('EFEX21');
        expect(() => loadXenvioApiConfig({ ...CREDENTIALS, XENVIO_API_TOKEN: '' })).toThrow(/Missing Xenvio API variables: XENVIO_API_TOKEN/);
    });

    test('an open order brings its own ship code and does not need the default one', async () => {
        const { api, sent } = fakeOrdersApi();
        const service = new ApiOrderService(api, null);
        const order = OrderBuilder.domestic().build();

        const created = await service.createOpenOrder({ recipient: order.recipient, plan: { box: order.product, item: order.item }, warehouse: 'qa22', shipCode: 'EUSPMI' });
        expect(created).toMatchObject({ shipmentState: 'pending', warehouseId: 334 });
        expect(sent[0].orders[0].shipments[0]).toMatchObject({ shipping_method_code: 'EUSPMI', create_label: false });
    });

    test('a shipped order without API_ORDER_SHIP_CODE fails before calling the API', async () => {
        const { api, sent } = fakeOrdersApi();
        await expect(new ApiOrderService(api, null).createShippedOrder(OrderBuilder.domestic().build(), 'qa20'))
            .rejects.toThrow(/Missing Xenvio API variables: API_ORDER_SHIP_CODE/);
        expect(sent).toEqual([]);
    });
});
