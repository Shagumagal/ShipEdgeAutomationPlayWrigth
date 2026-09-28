/**
 * Data contract: what a shipment imported from ShipEdge Core into Xenvio looks like,
 * as read from the `search_by_warehouse` response. Pure types — no Playwright.
 */

export interface CoreImportVerification {
    // Shipment-level
    shipmentNumber: string | null;
    orderNumber: string | null;
    aasmState: string | null;
    shippingMethodCode: string | null;

    // Customer
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: {
        address1: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
    } | null;

    // Boxes & Items
    boxes: Array<{
        boxNumber: string | null;
        length: string | null;
        width: string | null;
        height: string | null;
        weight: string | null;
        aasmState: string | null;
        items: Array<{
            sku: string | null;
            quantity: number | null;
            weight: number | null;
            price: number | null;
            description: string | null;
        }>;
    }>;

    // Carrier
    carrierName: string | null;
    shippingMethodName: string | null;

    // Warehouse / App
    warehouseName: string | null;
    appName: string | null;

    // Raw response for additional checks
    rawResponse: any;
}
