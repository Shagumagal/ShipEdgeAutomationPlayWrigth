import * as allure from 'allure-js-commons';
import AllureHelper from '../evidence/allure-helper';
import {
    buildApiOrderPayload,
    generateApiOrderNumbers,
    parseApiOrderResponse,
    type ApiOrderResult,
} from '../domain/orders/api-order';
import { TRANSIENT_RETRY_DELAY_MS, decideCarrierRetry } from '../domain/carriers/carrier-retry-policy';
import type { DomesticOrderTestData } from '../test-data';
import type { XenvioOrdersApi } from '../infrastructure/xenvio-orders-api';

export interface CreatedApiOrder extends ApiOrderResult {
    warehouseId: number;
}

export type ShippedApiOrder = CreatedApiOrder;

/**
 * Creates orders through Xenvio API v3 as test setup, so the UI is used only for the behavior
 * under test (e.g. void). Injected as the `apiOrders` fixture (lib/page-object-fixtures.ts).
 */
export class ApiOrderService {
    constructor(
        private readonly api: XenvioOrdersApi,
        private readonly shipCode: string,
    ) {}

    /**
     * Order whose label the API buys in the same call: it comes back already shipped.
     * A transient carrier error (e.g. SHIPMENT.POSTAGE.TIMED_OUT) is retried once with a new order,
     * following domain/carriers/carrier-retry-policy.ts; the failed one stays unshipped in QA.
     */
    async createShippedOrder(order: DomesticOrderTestData, warehouse: string): Promise<ShippedApiOrder> {
        return allure.step('Create shipped order through API v3', async () => {
            const result = await this.createWithCarrierRetry(order, warehouse, true);
            const warehouseId = await this.api.findWarehouseId(warehouse);

            await AllureHelper.addRunParameters({
                Shipment: result.shipmentNumber,
                'Ship code': this.shipCode,
                Tracking: result.trackingNumbers.join(', '),
            });
            console.log(`✅ Shipped order created through API v3 — ${result.shipmentNumber} (${this.shipCode}, tracking ${result.trackingNumbers.join(', ')})`);
            return { ...result, warehouseId };
        });
    }

    /**
     * Order without a label: the shipment stays open in the shipper view (GET RATES / GET LABELS),
     * e.g. to try other carriers in Configure Shipment. Nothing is bought.
     */
    async createOpenOrder(order: DomesticOrderTestData, warehouse: string): Promise<CreatedApiOrder> {
        return allure.step('Create open order through API v3', async () => {
            const result = await this.createWithCarrierRetry(order, warehouse, false);
            const warehouseId = await this.api.findWarehouseId(warehouse);

            await AllureHelper.addRunParameters({ Shipment: result.shipmentNumber });
            console.log(`✅ Open order created through API v3 — ${result.shipmentNumber}`);
            return { ...result, warehouseId };
        });
    }

    private async createWithCarrierRetry(
        order: DomesticOrderTestData,
        warehouse: string,
        createLabel: boolean,
    ): Promise<ApiOrderResult> {
        for (let retriesDone = 0; ; retriesDone++) {
            const payload = buildApiOrderPayload({
                recipient: order.recipient,
                plan: { box: order.product, item: order.item },
                warehouse,
                shipCode: this.shipCode,
                createLabel,
                ...generateApiOrderNumbers(),
            });
            try {
                return parseApiOrderResponse(await this.api.createOrder(payload), createLabel);
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
