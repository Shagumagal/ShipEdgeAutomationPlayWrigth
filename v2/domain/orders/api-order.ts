/**
 * Contract of Xenvio API v3 `POST /api/v3/orders/new` for one order with one box, domestic or
 * international (customs data).
 * Pure module — no Playwright. The HTTP call lives in infrastructure/xenvio-orders-api.ts.
 */
import { automationStamp } from '../test-data/automation-data';
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
    /** Sender; omitted → the warehouse address (only the phone is sent). */
    merchant?: ApiMerchant;
    /** Customs data an international order needs; omitted for domestic orders. */
    customs?: ApiCustomsData;
    /** Ask the carrier for a sample (test) label. */
    sampleLabel?: boolean;
}

export interface ApiMerchant {
    name: string;
    company?: string;
    email?: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

export interface ApiCustomsData {
    /** Order currency: the currency of the declared item values. */
    currency: string;
    /** Box category, which the carrier receives as the customs contents type (e.g. merchandise). */
    contentsType: string;
    itemDescription: string;
    harmonizationCode: string;
}

export interface ApiOrderResult {
    orderNumber: string;
    shipmentNumber: string;
    shipmentState: string | null;
    finalPostage: number | null;
    trackingNumbers: string[];
}

/** Unique order/shipment numbers, recognizable as API-created test data (e.g. QA-API-20261012-171503-k3f9). */
export function generateApiOrderNumbers(
    now: Date = new Date(),
    random: () => number = Math.random,
): { orderNumber: string; shipmentNumber: string } {
    const orderNumber = `QA-API-${automationStamp(now, random)}`;
    return { orderNumber, shipmentNumber: `${orderNumber}-S1` };
}

// A blank merchant address makes the API use the warehouse address as the sender; the phone is
// not copied from the warehouse and carriers such as FedEx require it.
const WAREHOUSE_SENDER: ApiMerchant = {
    name: 'QA Automation',
    phone: '4155550100',
    address1: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
};

export function buildApiOrderPayload(command: ApiOrderCommand) {
    const { recipient, plan: { box, item }, customs } = command;
    return {
        orders: [{
            order_number: command.orderNumber,
            warehouse: command.warehouse,
            ...(customs && { currency: customs.currency }),
            merchant: command.merchant ?? WAREHOUSE_SENDER,
            shipments: [{
                shipment_number: command.shipmentNumber,
                label_format: 'pdf',
                create_label: command.createLabel,
                ...(command.sampleLabel && { sample_label: true }),
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
                    ...(customs && { category: customs.contentsType }),
                    items: [{
                        sku: item.sku,
                        description: customs?.itemDescription ?? `QA item ${item.sku}`,
                        ...(customs && { harmonization: customs.harmonizationCode }),
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
 * The answer must be about the order that was sent (same order and shipment numbers).
 */
export function parseApiOrderResponse(
    body: any,
    sent: Pick<ApiOrderCommand, 'orderNumber' | 'shipmentNumber' | 'createLabel'>,
): ApiOrderResult {
    const order = Array.isArray(body) ? body[0] : body?.orders?.[0] ?? body;
    if (order?.status !== 'Success') {
        throw new Error(`API v3 rejected the order: ${brief(order?.errors ?? order?.error ?? 'unexpected response')}`);
    }

    const shipment = order.shipments?.[0];
    if (order.order_number !== sent.orderNumber || shipment?.shipment_number !== sent.shipmentNumber) {
        throw new Error(
            `API v3 answered for another order: expected ${sent.orderNumber} / ${sent.shipmentNumber}, `
            + `got ${order.order_number ?? 'none'} / ${shipment?.shipment_number ?? 'none'}`,
        );
    }

    const shipmentError = shipment.errors?.find(Boolean);
    if (shipmentError) {
        throw new Error(`API v3 created the order but the shipment failed: ${brief(shipmentError)}`);
    }

    const trackingNumbers: string[] = (shipment.boxes ?? [])
        .map((box: any) => box.tracking_number)
        .filter(Boolean);
    if (sent.createLabel && (shipment.status !== 'shipped' || trackingNumbers.length === 0)) {
        throw new Error(`API v3 did not ship the order (state: ${shipment.status ?? 'none'}, tracking: none)`);
    }

    return {
        orderNumber: sent.orderNumber,
        shipmentNumber: sent.shipmentNumber,
        shipmentState: shipment.status ?? null,
        // Rails serializes decimals as strings ("8.34")
        finalPostage: shipment.final_postage == null ? null : Number(shipment.final_postage),
        trackingNumbers,
    };
}

function brief(error: unknown): string {
    const text = typeof error === 'string' ? error : JSON.stringify(error);
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}
