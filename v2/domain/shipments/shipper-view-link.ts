/**
 * Direct link to a shipment in the Xenvio shipper view, printed in the run output so QA can
 * open the shipment with CMD+Click. Pure function — no Playwright.
 *
 *   https://x5demo1angular.shipedge.com/shipper-view?shipment_number=S141_X&warehouse_id=141&app_id=0
 *
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

    const link = new URL(url.origin + url.pathname);
    link.searchParams.set('shipment_number', shipment);
    link.searchParams.set('warehouse_id', warehouseId);
    link.searchParams.set('app_id', appId);
    return link.toString();
}
