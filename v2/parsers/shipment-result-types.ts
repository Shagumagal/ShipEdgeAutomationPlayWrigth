export interface LabelsByBox {
    boxIndex: number;
    /** Xenvio box id: the `reference` of the box in the carrier calls. */
    boxId?: number;
    label: string;
    returnLabel?: string;
    trackingNumber?: string;
    state?: string;
}

export interface GetLabelsResult {
    finalPostage: number | null;
    shippingCost: number | null;
    labelUrls: string[];
    docUrls: string[];
    labelsByBox: LabelsByBox[];
    shipmentState: string | null;
    orderNumber: string | null;
    shipmentNumber: string | null;
    /** Xenvio id of the shipment (View Requests, backend calls). */
    shipmentId: number | null;
    /** Services saved on the shipment: insurance, incoterm, taxIdentifiers... */
    services: Record<string, any> | null;
    /** Files of the shipment: commercial invoices (`type: 'invoice'`), uploaded documents... */
    documents: ShipmentDocument[];
    /** Shipper-view URL of the shipment, added by the workflow (null when the page is not on it). */
    shipmentLink: string | null;
}

export interface ShipmentDocument {
    name: string;
    /** Content type, e.g. application/pdf. */
    format: string | null;
    /** invoice, document, pallet_label, packing_list. */
    type: string | null;
    url: string;
}

export interface BoxVoidState {
    boxIndex: number;
    state: string | null;
    trackingNumber: string | null;
    labelState: string | null;
}

export interface VoidLabelResult {
    shipmentState: string | null;
    labelState: string | null;
    shipmentNumber: string | null;
    orderNumber: string | null;
    boxesVoidState: BoxVoidState[];
    /** Shipper-view URL of the shipment, added by the workflow (null when the page is not on it). */
    shipmentLink: string | null;
}
