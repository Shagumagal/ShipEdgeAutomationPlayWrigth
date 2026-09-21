import { Page } from '@playwright/test';
import { ProductDimensions } from '../../lib/test-data';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    getLabelsAndCaptureResult,
    logShipmentState,
    voidLabelAndCaptureResult,
    type GetLabelsResult,
    type VoidLabelResult,
} from '../lib/shipment-result-parser';
import { getLabelsWithReturnLabel } from '../parsers/return-label-workflow';
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

export type { GetLabelsResult, VoidLabelResult } from '../lib/shipment-result-parser';
export type { ReturnLabelCapture } from '../parsers/return-label-parser';
