import * as allure from 'allure-js-commons';
import { findEasyPostLabelExchanges, type EasyPostLabelExchange } from '../domain/carriers/easypost-label-log';
import { redactSensitive } from '../diagnostics/carrier-failure-report';
import type { XenvioApi } from '../infrastructure/xenvio-api';

/**
 * Reads what Xenvio sent to the carriers and what they answered (History → View Requests), so a
 * test can check the carrier exchange itself and not only Xenvio's summary of it. Injected as the
 * `carrierRequests` fixture (lib/page-object-fixtures.ts).
 */
export class CarrierRequestService {
    constructor(private readonly api: Pick<XenvioApi, 'listShipmentRequests'>) {}

    /**
     * EasyPost label calls of each box (POST /v2/shipments + /buy), attached to the report with
     * credentials masked. `missing` lists the boxes whose calls are not in the log.
     */
    async easyPostLabelExchanges(
        shipmentId: number,
        boxIds: number[],
    ): Promise<{ exchanges: EasyPostLabelExchange[]; missing: string[] }> {
        return allure.step('Read the EasyPost label calls (View Requests)', async () => {
            const records = await this.api.listShipmentRequests(shipmentId);
            const found = findEasyPostLabelExchanges(records, boxIds.map(String));
            await allure.attachment(
                'EasyPost label calls (View Requests)',
                JSON.stringify(redactSensitive({ shipmentId, ...found }), null, 2),
                'application/json',
            );
            return found;
        });
    }
}
