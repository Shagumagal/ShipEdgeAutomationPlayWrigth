import { test, expect } from '@playwright/test';
import {
    buildApiOrderPayload,
    generateApiOrderNumbers,
    parseApiOrderResponse,
    type ApiOrderCommand,
} from '../domain/orders/api-order';
import { shipperViewUrl } from '../domain/shipments/shipper-view-link';
import { OrderBuilder } from '../test-data';

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

    test('order numbers are unique, recognizable and never end with "_" (API rule)', () => {
        const now = new Date(2026, 9, 12, 17, 5, 3);
        const first = generateApiOrderNumbers(now);
        const second = generateApiOrderNumbers(now);

        expect(first.orderNumber).toMatch(/^QA-API-20261012-170503-[a-z0-9]+$/);
        expect(first.shipmentNumber).toBe(`${first.orderNumber}-S1`);
        expect(first.orderNumber).not.toBe(second.orderNumber);
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
