import * as allure from 'allure-js-commons';
import AllureHelper from '../evidence/allure-helper';
import {
    buildApiOrderPayload,
    generateApiOrderNumbers,
    parseApiOrderResponse,
    type ApiOrderCommand,
    type ApiOrderResult,
} from '../domain/orders/api-order';
import { TRANSIENT_RETRY_DELAY_MS, decideCarrierRetry } from '../domain/carriers/carrier-retry-policy';
import type { DomesticOrderTestData } from '../test-data';
import type { XenvioOrdersApi } from '../infrastructure/xenvio-orders-api';

export interface CreatedApiOrder extends ApiOrderResult {
    warehouseId: number;
}

/** An order the API shipped in the same call (label bought). */
export type ShippedApiOrder = CreatedApiOrder;

/** What an open order needs: everything but the numbers, which are generated. */
export type OpenApiOrderSetup = Omit<ApiOrderCommand, 'createLabel' | 'orderNumber' | 'shipmentNumber'>;

/**
 * Creates orders through Xenvio API v3 as test setup, so the UI is used only for the behavior
 * under test (e.g. void). Injected as the `apiOrders` fixture (lib/page-object-fixtures.ts).
 */
export class ApiOrderService {
    constructor(
        private readonly api: Pick<XenvioOrdersApi, 'createOrder' | 'findWarehouseId'>,
        /** API_ORDER_SHIP_CODE: used by createShippedOrder only; null when not configured. */
        private readonly defaultShipCode: string | null,
    ) {}

    /**
     * Order whose label the API buys in the same call: it comes back already shipped.
     * A transient carrier error (e.g. SHIPMENT.POSTAGE.TIMED_OUT) is retried once with a new order,
     * following domain/carriers/carrier-retry-policy.ts; the failed one stays unshipped in QA.
     */
    async createShippedOrder(order: DomesticOrderTestData, warehouse: string): Promise<ShippedApiOrder> {
        const shipCode = this.defaultShipCode;
        if (!shipCode) {
            throw new Error('Missing Xenvio API variables: API_ORDER_SHIP_CODE. Add it to .env to ship orders through API v3 (docs/16).');
        }
        return allure.step('Create shipped order through API v3', async () => {
            const result = await this.createWithCarrierRetry(order, warehouse, shipCode);
            const warehouseId = await this.api.findWarehouseId(warehouse);

            await AllureHelper.addRunParameters({
                Shipment: result.shipmentNumber,
                'Ship code': shipCode,
                Tracking: result.trackingNumbers.join(', '),
            });
            console.log(`✅ Shipped order created through API v3 — ${result.shipmentNumber} (${shipCode}, tracking ${result.trackingNumbers.join(', ')})`);
            return { ...result, warehouseId };
        });
    }

    /**
     * Order left open (no label), so the test works on it in the Shipper View. Its ship code, sender
     * and customs data come from `setup`: the default ship code of this service is not used.
     */
    async createOpenOrder(setup: OpenApiOrderSetup): Promise<CreatedApiOrder> {
        return allure.step('Create open order through API v3', async () => {
            const command: ApiOrderCommand = { ...setup, createLabel: false, ...generateApiOrderNumbers() };
            const [answer, warehouseId] = await Promise.all([
                this.api.createOrder(buildApiOrderPayload(command)),
                this.api.findWarehouseId(setup.warehouse),
            ]);
            const result = parseApiOrderResponse(answer, command);

            await AllureHelper.addRunParameters({
                Shipment: result.shipmentNumber,
                'Ship code': setup.shipCode,
            });
            console.log(`✅ Open order created through API v3 — ${result.shipmentNumber} (${setup.shipCode}, ${result.shipmentState})`);
            return { ...result, warehouseId };
        });
    }

    private async createWithCarrierRetry(order: DomesticOrderTestData, warehouse: string, shipCode: string): Promise<ApiOrderResult> {
        for (let retriesDone = 0; ; retriesDone++) {
            const command: ApiOrderCommand = {
                recipient: order.recipient,
                plan: { box: order.product, item: order.item },
                warehouse,
                shipCode,
                createLabel: true,
                ...generateApiOrderNumbers(),
            };
            try {
                return parseApiOrderResponse(await this.api.createOrder(buildApiOrderPayload(command)), command);
            } catch (error) {
                const message = (error as Error).message;
                const decision = decideCarrierRetry(message, retriesDone);
                if (!decision.retry) throw error;
                console.warn(`⚠️ ${message} — ${decision.reason}. Retrying in ${TRANSIENT_RETRY_DELAY_MS / 1000}s...`);
                await allure.step(`Retry API order after transient carrier error (${retriesDone + 1})`, async () => {
                    await allure.attachment('Transient carrier error', message, 'text/plain');
                });
                await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
            }
        }
    }
}
