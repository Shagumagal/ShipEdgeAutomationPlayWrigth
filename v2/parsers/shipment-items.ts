/**
 * SKUs from `expectedSkus` that the first shipment of a task_executor response does not contain
 * (case-insensitive). Empty when every item was saved.
 */
export function findMissingSkus(responseBody: any, expectedSkus: string[]): string[] {
    const saved = new Set<string>(
        (responseBody?.shipments?.[0]?.boxes ?? [])
            .flatMap((box: any) => box?.items ?? [])
            .map((item: any) => String(item?.sku ?? '').toLowerCase()),
    );
    return expectedSkus.filter((sku) => !saved.has(sku.toLowerCase()));
}
