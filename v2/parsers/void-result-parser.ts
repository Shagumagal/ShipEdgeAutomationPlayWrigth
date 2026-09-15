import { BoxVoidState, VoidLabelResult } from './shipment-result-types';

/** Parse the captured task_executor response for a void_label operation. */
export function parseVoidLabelResponse(voidResponseBody: any): VoidLabelResult {
    let shipmentState: string | null = null;
    let labelState: string | null = null;
    let shipmentNumber: string | null = null;
    let orderNumber: string | null = null;
    const boxesVoidState: BoxVoidState[] = [];

    if (voidResponseBody) {
        const shipment = voidResponseBody?.shipments?.[0];
        if (shipment) {
            shipmentState = shipment.aasmState || shipment.aasm_state || null;
            shipmentNumber = shipment.shipmentNumber || shipment.shipment_number || null;
            orderNumber = shipment.order?.orderNumber || shipment.order?.order_number || null;

            if (shipment.boxes) {
                shipment.boxes.forEach((box: any, idx: number) => {
                    const boxLabelState = box.labelState || box.label_state || null;
                    if (idx === 0) labelState = boxLabelState;
                    boxesVoidState.push({
                        boxIndex: idx + 1,
                        state: box.aasmState || box.aasm_state || null,
                        trackingNumber: box.trackingNumber || box.tracking_number || null,
                        labelState: boxLabelState,
                    });
                });
            }
        }
    }

    return { shipmentState, labelState, shipmentNumber, orderNumber, boxesVoidState };
}
