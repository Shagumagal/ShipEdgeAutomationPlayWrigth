/** An item the test put in a box: `box` is the box position in creation order (1 = first box). */
export interface ExpectedBoxItem {
    box: number;
    sku: string;
    quantity: number;
}

/**
 * Differences between the shipment Xenvio saved (task_executor response) and the items the test
 * added: wrong shipment, missing box, item in another box, or another quantity. Empty when every
 * item is in its box. Boxes are compared in creation order (ascending id): the response carries
 * no box number.
 */
export function findItemMismatches(
    responseBody: any,
    expected: { shipmentNumber: string | null; items: ExpectedBoxItem[] },
): string[] {
    const shipment = responseBody?.shipments?.[0];
    if (!shipment) return ['the response has no shipment'];

    const problems: string[] = [];
    if (expected.shipmentNumber && shipment.shipmentNumber !== expected.shipmentNumber) {
        problems.push(`the response is for shipment ${shipment.shipmentNumber ?? 'none'}, expected ${expected.shipmentNumber}`);
    }

    const boxes: any[] = [...(shipment.boxes ?? [])].sort((a, b) => Number(a?.id) - Number(b?.id));
    for (const { box, sku, quantity } of expected.items) {
        const items: any[] = boxes[box - 1]?.items ?? [];
        const saved = items.find((item) => String(item?.sku ?? '').toLowerCase() === sku.toLowerCase());
        if (!boxes[box - 1]) {
            problems.push(`box ${box} does not exist (the shipment has ${boxes.length})`);
        } else if (!saved) {
            problems.push(`box ${box} has no item ${sku}`);
        } else if (Number(saved.quantity) !== quantity) {
            problems.push(`box ${box} item ${sku} has quantity ${saved.quantity}, expected ${quantity}`);
        }
    }
    return problems;
}
