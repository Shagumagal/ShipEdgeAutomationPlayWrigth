import { test, expect } from '@playwright/test';
import { findMissingSkus } from '../parsers/shipment-items';

const saved = {
    shipments: [{
        boxes: [
            { items: [{ sku: 'QA-SKU-1' }] },
            { items: [{ sku: 'qa-sku-2' }, { sku: 'OTHER' }] },
        ],
    }],
};

test.describe('Saved item confirmation', { tag: ['@unit', '@packages'] }, () => {

    test('nothing is missing when every SKU is in some box (case-insensitive)', () => {
        expect(findMissingSkus(saved, ['QA-SKU-1', 'QA-SKU-2'])).toEqual([]);
    });

    test('lists the SKUs the saved shipment does not have', () => {
        expect(findMissingSkus(saved, ['QA-SKU-1', 'QA-SKU-3'])).toEqual(['QA-SKU-3']);
    });

    test('a response without boxes or items is missing everything', () => {
        expect(findMissingSkus({ shipments: [{}] }, ['QA-SKU-1'])).toEqual(['QA-SKU-1']);
        expect(findMissingSkus(null, ['QA-SKU-1'])).toEqual(['QA-SKU-1']);
    });
});
