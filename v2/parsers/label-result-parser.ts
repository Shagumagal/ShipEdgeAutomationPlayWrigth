import { GetLabelsResult, LabelsByBox } from './shipment-result-types';

/** Parse the captured task_executor response for a label operation. */
export function parseGetLabelsResponse(labelResponseBody: any): GetLabelsResult {
    let finalPostage: number | null = null;
    let shippingCost: number | null = null;
    const labelUrls: string[] = [];
    const docUrls: string[] = [];
    const labelsByBox: LabelsByBox[] = [];
    let shipmentState: string | null = null;
    let orderNumber: string | null = null;
    let shipmentNumber: string | null = null;

    if (labelResponseBody) {
        const shipment = labelResponseBody?.shipments?.[0];
        if (shipment) {
            finalPostage = typeof shipment.finalPostage === 'number' ? shipment.finalPostage : null;
            shippingCost = typeof shipment.shippingCost === 'number' ? shipment.shippingCost : null;
            shipmentState = shipment.aasmState || null;
            shipmentNumber = shipment.shipmentNumber || null;
            orderNumber = shipment.order?.orderNumber || null;

            if (shipment.boxes) {
                shipment.boxes.forEach((box: any, idx: number) => {
                    labelsByBox.push({
                        boxIndex: idx + 1,
                        label: box.label || '',
                        returnLabel: box.returnLabel || undefined,
                        trackingNumber: box.trackingNumber || box.tracking_number || undefined,
                        state: box.aasmState || box.aasm_state || undefined,
                    });
                    if (box.label) labelUrls.push(box.label);
                    if (box.returnLabel) labelUrls.push(box.returnLabel);
                });
            }
        }

        try {
            const jsonStr = JSON.stringify(labelResponseBody);
            const pdfMatches = [...jsonStr.matchAll(/https?:\/\/[^\s"]+\.pdf[^\s"]*/gi)];
            for (const match of pdfMatches) {
                const url = match[0].replace(/[",]/g, '').trim();
                if (url.toLowerCase().includes('invoice') || url.toLowerCase().includes('commercial')) {
                    if (!docUrls.includes(url)) docUrls.push(url);
                } else if (
                    !labelUrls.includes(url)
                    && !labelsByBox.some(box => box.label === url || box.returnLabel === url)
                ) {
                    labelUrls.push(url);
                }
            }
        } catch {
            console.log('⚠️ Failed to extract extra document URLs from JSON string');
        }
    }

    return {
        finalPostage,
        shippingCost,
        labelUrls,
        docUrls,
        labelsByBox,
        shipmentState,
        orderNumber,
        shipmentNumber,
    };
}
