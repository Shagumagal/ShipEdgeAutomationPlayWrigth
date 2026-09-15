export interface LabelsByBox {
    boxIndex: number;
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
}
