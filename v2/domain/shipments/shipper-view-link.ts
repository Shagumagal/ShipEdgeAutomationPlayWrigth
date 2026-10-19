export interface ShipperViewTarget {
    shipmentNumber: string;
    warehouseId: number | string;
    /** 0 = no app selected (orders created through the API or the default UI flow). */
    appId: number | string;
}

/**
 * URL of a shipment in the shipper view of the Angular app at `origin`. Pure — no Playwright.
 *
 *   https://x5demo1angular.shipedge.com/shipper-view?shipment_number=S141_X&warehouse_id=141&app_id=0
 */
export function shipperViewUrl(origin: string, target: ShipperViewTarget): string {
    const link = new URL('/shipper-view', origin);
    link.searchParams.set('shipment_number', target.shipmentNumber);
    link.searchParams.set('warehouse_id', String(target.warehouseId));
    link.searchParams.set('app_id', String(target.appId));
    return link.toString();
}

/** The shipment a shipper-view URL is showing (`?shipment_number=`), or null. */
export function shipmentNumberFromUrl(url: string): string | null {
    try {
        return new URL(url).searchParams.get('shipment_number') || null;
    } catch {
        return null;
    }
}

/**
 * Direct link to a shipment, printed in the run output so QA can open it with CMD+Click.
 * Built from the URL of the page the test is on, which already carries the Angular host,
 * warehouse_id and app_id. Returns null when that URL is not a shipment in the shipper view.
 */
export function buildShipperViewLink(currentUrl: string, shipmentNumber?: string | null): string | null {
    let url: URL;
    try {
        url = new URL(currentUrl);
    } catch {
        return null;
    }

    const shipment = shipmentNumber || url.searchParams.get('shipment_number');
    const warehouseId = url.searchParams.get('warehouse_id');
    const appId = url.searchParams.get('app_id');
    if (!url.pathname.includes('shipper-view') || !shipment || !warehouseId || appId === null) {
        return null;
    }

    return shipperViewUrl(url.origin, { shipmentNumber: shipment, warehouseId, appId });
}
