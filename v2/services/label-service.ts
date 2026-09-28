import { Page } from '@playwright/test';
import { ProductDimensions } from "../test-data";
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { logShipmentState } from '../parsers/shipment-state-logger';
import type { GetLabelsResult, VoidLabelResult } from '../parsers/shipment-result-types';
import { getLabelsAndCaptureResult } from '../workflows/get-labels-workflow';
import { getLabelsWithReturnLabel } from '../workflows/return-label-workflow';
import { voidLabelAndCaptureResult } from '../workflows/void-label-workflow';
import type { ReturnLabelCapture } from '../parsers/return-label-parser';
import AllureHelper from '../evidence/allure-helper';

/** Owns label generation, voiding and interpretation of shipment results. */
export class LabelService {
    static async generate(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 180000,
    ): Promise<GetLabelsResult> {
        const result = await getLabelsAndCaptureResult(popupPage, orderToLabelPage, timeoutMs);

        // Business data of this run, visible in the report next to the test
        await AllureHelper.addRunParameters({
            'Final postage': result.finalPostage,
            'Shipping cost': result.shippingCost,
            'Labels generated': result.labelsByBox.length || result.labelUrls.length,
            'Shipment state': result.shipmentState,
        });
        return result;
    }

    /** GET LABELS when a return label is configured: captures forward + return and retries on failure. */
    static generateWithReturnLabel(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
    ): Promise<ReturnLabelCapture> {
        return getLabelsWithReturnLabel(popupPage, orderToLabelPage);
    }

    static async void(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 120000,
    ): Promise<VoidLabelResult> {
        const result = await voidLabelAndCaptureResult(popupPage, orderToLabelPage, timeoutMs);
        await AllureHelper.addRunParameters({ 'Shipment state after void': result.shipmentState });
        return result;
    }

    static logShipmentState(responseBody: unknown, expectedPkg?: ProductDimensions): void {
        logShipmentState(responseBody, expectedPkg);
    }
}

export type { GetLabelsResult, VoidLabelResult } from '../parsers/shipment-result-types';
export type { ReturnLabelCapture } from '../parsers/return-label-parser';
