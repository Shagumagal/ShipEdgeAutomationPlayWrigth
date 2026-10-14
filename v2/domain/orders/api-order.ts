/**
 * Contract of Xenvio API v3 `POST /api/v3/orders/new` for one order with one box.
 * Pure module — no Playwright. The HTTP call lives in infrastructure/xenvio-orders-api.ts.
 */
import type { DomesticPackagePlan } from '../packages/domestic-package-plan';
import type { RecipientData } from './order-data';

export interface ApiOrderCommand {
    recipient: RecipientData;
    plan: DomesticPackagePlan;
    warehouse: string;
    /** Must exist only once among the warehouse's active carriers: the API takes the first match. */
    shipCode: string;
    /** true → the API buys the label in the same call and the shipment comes back shipped. */
    createLabel: boolean;
    orderNumber: string;
    shipmentNumber: string;
}

export interface ApiOrderResult {
    orderNumber: string;
    shipmentNumber: string;
    shipmentState: string | null;
    finalPostage: number | null;
    trackingNumbers: string[];
}

/** Unique order/shipment numbers, recognizable as API-created test data (e.g. QA-API-20261012-171503-k3f9). */
export function generateApiOrderNumbers(now: Date = new Date()): { orderNumber: string; shipmentNumber: string } {
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
        + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const orderNumber = `QA-API-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    return { orderNumber, shipmentNumber: `${orderNumber}-S1` };
}

export function buildApiOrderPayload(command: ApiOrderCommand) {
    const { recipient, plan: { box, item } } = command;
    return {
        orders: [{
            order_number: command.orderNumber,
            warehouse: command.warehouse,
            // A blank merchant address makes the API use the warehouse address as the sender; the
            // phone is not copied from the warehouse and carriers such as FedEx require it.
            merchant: {
                name: 'QA Automation',
                phone: '4155550100',
                address1: '',
                city: '',
                state: '',
                zip: '',
                country: 'US',
            },
            shipments: [{
                shipment_number: command.shipmentNumber,
                label_format: 'pdf',
                create_label: command.createLabel,
                shipping_method_code: command.shipCode,
                customer: {
                    name: recipient.name,
                    company: recipient.company,
                    email: recipient.email,
                    phone: recipient.phone,
                    address1: recipient.address1,
                    address2: recipient.address2,
                    city: recipient.city,
                    state: recipient.state,
                    zip: recipient.zip,
                    country: recipient.country,
                },
                boxes: [{
                    box_number: 1,
                    weight: Number(box.weight),
                    length: Number(box.length),
                    width: Number(box.width),
                    height: Number(box.height),
                    items: [{
                        sku: item.sku,
                        description: `QA item ${item.sku}`,
                        quantity: Number(item.qty),
                        sold_price: Number(item.unitPrice),
                        weight: Number(item.weight),
                        length: Number(item.length),
                        width: Number(item.width),
                        height: Number(item.height),
                        country: item.country,
                    }],
                }],
            }],
        }],
    };
}

/**
 * Reads the API answer `{ orders: [order] }`, throwing with the API's own message when the order
 * or its label failed: validation errors come back as `[{ status: 'Bad Request', errors }]` (or
 * Grape's `{ error }`), and a failed label as `status: 'Success'` with the carrier message in
 * `shipments[0].errors`. Messages never include the body, which carries base64 labels.
 */
export function parseApiOrderResponse(body: any, expectLabel: boolean): ApiOrderResult {
    const order = Array.isArray(body) ? body[0] : body?.orders?.[0] ?? body;
    if (order?.status !== 'Success') {
        throw new Error(`API v3 rejected the order: ${brief(order?.errors ?? order?.error ?? 'unexpected response')}`);
    }

    const shipment = order.shipments?.[0];
    const shipmentError = shipment?.errors?.find(Boolean);
    if (shipmentError) {
        throw new Error(`API v3 created the order but the shipment failed: ${brief(shipmentError)}`);
    }

    const trackingNumbers: string[] = (shipment?.boxes ?? [])
        .map((box: any) => box.tracking_number)
        .filter(Boolean);
    if (expectLabel && (shipment?.status !== 'shipped' || trackingNumbers.length === 0)) {
        throw new Error(`API v3 did not ship the order (state: ${shipment?.status ?? 'none'}, tracking: none)`);
    }

    return {
        orderNumber: order.order_number,
        shipmentNumber: shipment?.shipment_number,
        shipmentState: shipment?.status ?? null,
        // Rails serializes decimals as strings ("8.34")
        finalPostage: shipment?.final_postage == null ? null : Number(shipment.final_postage),
        trackingNumbers,
    };
}

function brief(error: unknown): string {
    const text = typeof error === 'string' ? error : JSON.stringify(error);
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}
