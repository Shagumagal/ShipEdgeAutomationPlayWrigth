import { test, expect } from '@playwright/test';
import { buildShipperViewLink, shipmentNumberFromUrl } from '../domain/shipments/shipper-view-link';

const DETAIL_URL = 'https://x5demo1angular.shipedge.com/shipper-view?shipment_number=S141_AAA&warehouse_id=141&app_id=0';

test.describe('Shipper view link', { tag: ['@unit', '@shipments'] }, () => {

    test('points to the given shipment, keeping host, warehouse and app of the current page', () => {
        expect(buildShipperViewLink(DETAIL_URL, 'S141_MV5MKKOS')).toBe(
            'https://x5demo1angular.shipedge.com/shipper-view?shipment_number=S141_MV5MKKOS&warehouse_id=141&app_id=0',
        );
    });

    test('falls back to the shipment of the current page when none is given', () => {
        expect(buildShipperViewLink(DETAIL_URL, null)).toBe(DETAIL_URL);
    });

    test('drops any other query parameter of the current page', () => {
        expect(buildShipperViewLink(`${DETAIL_URL}&tab=documents`)).toBe(DETAIL_URL);
    });

    test('returns null when the page is not a shipment in the shipper view', () => {
        expect(buildShipperViewLink('https://x5demo1angular.shipedge.com/dashboard', 'S141_AAA')).toBeNull();
        expect(buildShipperViewLink('https://x5demo1angular.shipedge.com/shipper-view', 'S141_AAA')).toBeNull();
        expect(buildShipperViewLink('about:blank', 'S141_AAA')).toBeNull();
        expect(buildShipperViewLink('not a url', 'S141_AAA')).toBeNull();
    });

    test('reads the shipment a URL is showing', () => {
        expect(shipmentNumberFromUrl(DETAIL_URL)).toBe('S141_AAA');
        expect(shipmentNumberFromUrl('https://x5demo1angular.shipedge.com/shipper-view')).toBeNull();
        expect(shipmentNumberFromUrl('not a url')).toBeNull();
    });
});
