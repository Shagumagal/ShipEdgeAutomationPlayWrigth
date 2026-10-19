import { test, expect } from '@playwright/test';
import { findItemMismatches, type ExpectedBoxItem } from '../parsers/shipment-items';

/** Shaped like a real task_executor answer (S339_MVF6HWNS): boxes by id, no box number. */
function savedShipment(boxes: { id: number; items: { sku: string; quantity: number }[] }[], shipmentNumber = 'S339_TEST') {
    return { shipments: [{ shipmentNumber, boxes: boxes.map((box) => ({ ...box, boxNumber: null })) }] };
}

const threeBoxes: ExpectedBoxItem[] = [
    { box: 1, sku: 'QA-MULTIBOX-ITEM-1', quantity: 1 },
    { box: 2, sku: 'QA-MULTIBOX-ITEM-2', quantity: 1 },
    { box: 3, sku: 'QA-MULTIBOX-ITEM-3', quantity: 1 },
];

test.describe('Saved item confirmation', { tag: ['@unit', '@packages'] }, () => {

    test('every item in its box with its quantity, in creation order even if the response is not', () => {
        const saved = savedShipment([
            { id: 6372656, items: [{ sku: 'QA-MULTIBOX-ITEM-3', quantity: 1 }] },
            { id: 6372654, items: [{ sku: 'qa-multibox-item-1', quantity: 1 }] },
            { id: 6372655, items: [{ sku: 'QA-MULTIBOX-ITEM-2', quantity: 1 }] },
        ]);
        expect(findItemMismatches(saved, { shipmentNumber: 'S339_TEST', items: threeBoxes })).toEqual([]);
    });

    test('items piled in the first box while another box stays empty fail', () => {
        const saved = savedShipment([
            { id: 1, items: [{ sku: 'QA-SKU-1', quantity: 1 }, { sku: 'QA-SKU-2', quantity: 1 }] },
            { id: 2, items: [] },
        ]);
        expect(findItemMismatches(saved, {
            shipmentNumber: 'S339_TEST',
            items: [{ box: 1, sku: 'QA-SKU-1', quantity: 1 }, { box: 2, sku: 'QA-SKU-2', quantity: 1 }],
        })).toEqual(['box 2 has no item QA-SKU-2']);
    });

    test('a different quantity fails', () => {
        const saved = savedShipment([{ id: 1, items: [{ sku: 'QA-SKU-1', quantity: 2 }] }]);
        expect(findItemMismatches(saved, { shipmentNumber: 'S339_TEST', items: [{ box: 1, sku: 'QA-SKU-1', quantity: 1 }] }))
            .toEqual(['box 1 item QA-SKU-1 has quantity 2, expected 1']);
    });

    test('a missing box fails', () => {
        const saved = savedShipment([{ id: 1, items: [{ sku: 'QA-SKU-1', quantity: 1 }] }]);
        expect(findItemMismatches(saved, { shipmentNumber: 'S339_TEST', items: [{ box: 2, sku: 'QA-SKU-2', quantity: 1 }] }))
            .toEqual(['box 2 does not exist (the shipment has 1)']);
    });

    test('an answer about another shipment fails', () => {
        const saved = savedShipment([{ id: 1, items: [{ sku: 'QA-SKU-1', quantity: 1 }] }], 'S339_OTHER');
        expect(findItemMismatches(saved, { shipmentNumber: 'S339_TEST', items: [{ box: 1, sku: 'QA-SKU-1', quantity: 1 }] }))
            .toEqual(['the response is for shipment S339_OTHER, expected S339_TEST']);
    });

    test('a response without a shipment fails', () => {
        expect(findItemMismatches(null, { shipmentNumber: 'S339_TEST', items: threeBoxes })).toEqual(['the response has no shipment']);
    });
});
