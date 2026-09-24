import { Page } from '@playwright/test';
import { ProductDimensions } from '../../lib/test-data';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import { logShipmentState } from '../parsers/shipment-state-logger';
import type { GetLabelsResult, VoidLabelResult } from '../parsers/shipment-result-types';
import { getLabelsAndCaptureResult } from '../workflows/get-labels-workflow';
import { getLabelsWithReturnLabel } from '../workflows/return-label-workflow';
import { voidLabelAndCaptureResult } from '../workflows/void-label-workflow';
import type { ReturnLabelCapture } from '../parsers/return-label-parser';

/** Owns label generation, voiding and interpretation of shipment results. */
export class LabelService {
    static generate(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 180000,
    ): Promise<GetLabelsResult> {
        return getLabelsAndCaptureResult(popupPage, orderToLabelPage, timeoutMs);
    }

    /** GET LABELS when a return label is configured: captures forward + return and retries on failure. */
    static generateWithReturnLabel(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
    ): Promise<ReturnLabelCapture> {
        return getLabelsWithReturnLabel(popupPage, orderToLabelPage);
    }

    static void(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 120000,
    ): Promise<VoidLabelResult> {
        return voidLabelAndCaptureResult(popupPage, orderToLabelPage, timeoutMs);
    }

    static logShipmentState(responseBody: unknown, expectedPkg?: ProductDimensions): void {
        logShipmentState(responseBody, expectedPkg);
    }
}

export type { GetLabelsResult, VoidLabelResult } from '../parsers/shipment-result-types';
export type { ReturnLabelCapture } from '../parsers/return-label-parser';
