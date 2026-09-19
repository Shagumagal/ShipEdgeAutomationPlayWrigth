import type { ProductDimensions } from '../../../lib/test-data';

export type DomesticItemData = ProductDimensions & {
    sku: string;
    country: string;
    unitPrice: string;
};

export interface DomesticPackagePlan {
    box: ProductDimensions;
    item: DomesticItemData;
}

function positiveNumber(value: string, field: string): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${field} must be a positive number; received "${value}"`);
    }

    return parsed;
}

/** Fails before UI interaction when item data is physically inconsistent with its box. */
export function validateDomesticPackagePlan(plan: DomesticPackagePlan): void {
    const boxWeight = positiveNumber(plan.box.weight, 'box.weight');
    const itemWeight = positiveNumber(plan.item.weight, 'item.weight');
    const quantity = positiveNumber(plan.item.qty, 'item.qty');
    const unitPrice = positiveNumber(plan.item.unitPrice, 'item.unitPrice');

    if (itemWeight * quantity > boxWeight) {
        throw new Error(
            `Item total weight (${itemWeight * quantity}) cannot exceed box weight (${boxWeight})`,
        );
    }

    for (const dimension of ['length', 'width', 'height'] as const) {
        const boxValue = positiveNumber(plan.box[dimension], `box.${dimension}`);
        const itemValue = positiveNumber(plan.item[dimension], `item.${dimension}`);

        if (itemValue > boxValue) {
            throw new Error(
                `item.${dimension} (${itemValue}) cannot exceed box.${dimension} (${boxValue})`,
            );
        }
    }

    if (!plan.item.sku.trim()) {
        throw new Error('item.sku is required');
    }

    if (!plan.item.country.trim()) {
        throw new Error('item.country is required');
    }

    if (unitPrice <= 0) {
        throw new Error('item.unitPrice must be greater than zero');
    }
}

/** Conservative fallback for legacy callers that only provide box dimensions. */
export function createDomesticItemForBox(
    box: ProductDimensions,
    sku = 'QA-CARRIER-SAFE-ITEM',
): DomesticItemData {
    const proportionalValue = (value: string): string => {
        const numeric = positiveNumber(value, 'box dimension');
        return Math.max(1, Math.floor(numeric * 0.6)).toString();
    };

    const boxWeight = positiveNumber(box.weight, 'box.weight');
    const itemWeight = Math.max(1, Math.floor(boxWeight * 0.4));

    return {
        sku,
        qty: '1',
        weight: Math.min(itemWeight, boxWeight).toString(),
        length: proportionalValue(box.length),
        width: proportionalValue(box.width),
        height: proportionalValue(box.height),
        country: 'US',
        unitPrice: '20',
    };
}
