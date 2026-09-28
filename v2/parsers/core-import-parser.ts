import type { CoreImportVerification } from '../domain/orders/core-import-verification';

/**
 * Pure parsing of the Xenvio `search_by_warehouse` response into the import contract.
 * Missing fields become null instead of throwing, so the spec can assert on them.
 */
export function parseImportedShipmentData(responseBody: any): CoreImportVerification {
    const shipment = responseBody?.shipments?.[0];

    if (!shipment) {
        console.warn('⚠️ No shipment data found in search_by_warehouse response');
        return {
            shipmentNumber: null, orderNumber: null, aasmState: null,
            shippingMethodCode: null, customerName: null, customerEmail: null,
            customerPhone: null, customerAddress: null, boxes: [],
            carrierName: null, shippingMethodName: null,
            warehouseName: null, appName: null, rawResponse: responseBody,
        };
    }

    const customer = shipment.customer;
    const order = shipment.order;
    const methodConfig = shipment.shippingMethodConfig;

    return {
        shipmentNumber: shipment.shipmentNumber || null,
        orderNumber: order?.orderNumber || null,
        aasmState: shipment.aasmState || null,
        shippingMethodCode: methodConfig?.clientCode || shipment.shippingMethodCode || null,

        customerName: customer?.name || null,
        customerEmail: customer?.email || null,
        customerPhone: customer?.phone || null,
        customerAddress: customer?.address ? {
            address1: customer.address.address1 || null,
            city: customer.address.city || null,
            state: customer.address.state || null,
            zip: customer.address.zip || null,
            country: customer.address.country || null,
        } : null,

        boxes: (shipment.boxes || []).map((box: any) => ({
            boxNumber: box.boxNumber || null,
            length: box.length || null,
            width: box.width || null,
            height: box.height || null,
            weight: box.weight || null,
            aasmState: box.aasmState || null,
            items: (box.items || []).map((item: any) => ({
                sku: item.sku || null,
                quantity: item.quantity ?? null,
                weight: item.weight ?? null,
                price: item.price ?? null,
                description: item.description || null,
            })),
        })),

        carrierName: methodConfig?.shippingMethod?.carrier?.name || null,
        shippingMethodName: methodConfig?.shippingMethod?.name || null,

        warehouseName: order?.warehouse?.name || null,
        appName: order?.app?.name || null,

        rawResponse: responseBody,
    };
}

/**
 * Pretty-print the imported shipment verification results.
 */
