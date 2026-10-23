import { GetLabelsResult, LabelsByBox, ShipmentDocument } from './shipment-result-types';

/** Parse the captured task_executor response for a label operation (the workflow adds shipmentLink). */
export function parseGetLabelsResponse(labelResponseBody: any): Omit<GetLabelsResult, 'shipmentLink'> {
    let finalPostage: number | null = null;
    let shippingCost: number | null = null;
    const labelUrls: string[] = [];
    const docUrls: string[] = [];
    const labelsByBox: LabelsByBox[] = [];
    let shipmentState: string | null = null;
    let orderNumber: string | null = null;
    let shipmentNumber: string | null = null;
    let shipmentId: number | null = null;
    let services: Record<string, any> | null = null;
    let documents: ShipmentDocument[] = [];

    if (labelResponseBody) {
        const shipment = labelResponseBody?.shipments?.[0];
        if (shipment) {
            finalPostage = typeof shipment.finalPostage === 'number' ? shipment.finalPostage : null;
            shippingCost = typeof shipment.shippingCost === 'number' ? shipment.shippingCost : null;
            shipmentState = shipment.aasmState || null;
            shipmentNumber = shipment.shipmentNumber || null;
            orderNumber = shipment.order?.orderNumber || null;
            shipmentId = typeof shipment.id === 'number' ? shipment.id : null;
            services = shipment.services && typeof shipment.services === 'object' ? shipment.services : null;
            documents = parseDocuments(shipment.documents);

            if (shipment.boxes) {
                shipment.boxes.forEach((box: any, idx: number) => {
                    labelsByBox.push({
                        boxIndex: idx + 1,
                        boxId: box.id == null ? undefined : Number(box.id),
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
        shipmentId,
        services,
        documents,
    };
}

/** `documents` of the serialized shipment ({ name, format, type, url }); anything else is ignored. */
function parseDocuments(documents: unknown): ShipmentDocument[] {
    if (!Array.isArray(documents)) return [];
    return documents
        .filter((document) => document && typeof document === 'object' && document.url)
        .map((document) => ({
            name: String(document.name ?? ''),
            format: document.format ?? null,
            type: document.type ?? null,
            url: String(document.url),
        }));
}
