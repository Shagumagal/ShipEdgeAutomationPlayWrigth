import { expect, type Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import type { GetLabelsResult } from '../parsers/shipment-result-types';
import type { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

export type LabelDocumentKind = 'forward' | 'return';

export interface LabelDocumentEvidence {
    kind: LabelDocumentKind;
    url: string;
}

export interface LabelBoxEvidence {
    boxIndex: number;
    trackingNumber: string | null;
    state?: string | null;
    documents: LabelDocumentEvidence[];
}

export interface LabelGenerationEvidence {
    shipmentNumber: string;
    responseShipmentNumber: string | null;
    shipmentState: string | null;
    finalPostage: number | null;
    shippingCost?: number | null;
    boxes: LabelBoxEvidence[];
    details?: Record<string, unknown>;
}

interface DownloadedLabel {
    attachmentName: string;
    content: Buffer;
}

/** Creates strict, reusable Allure evidence for individual, return and multibox labels. */
export class LabelEvidenceService {
    static fromGetLabelsResult(
        shipmentNumber: string,
        result: GetLabelsResult,
        details?: Record<string, unknown>,
    ): LabelGenerationEvidence {
        return {
            shipmentNumber,
            responseShipmentNumber: result.shipmentNumber,
            shipmentState: result.shipmentState,
            finalPostage: result.finalPostage,
            shippingCost: result.shippingCost,
            boxes: result.labelsByBox.map((box) => ({
                boxIndex: box.boxIndex,
                trackingNumber: box.trackingNumber ?? null,
                state: box.state ?? null,
                documents: [
                    ...(box.label ? [{ kind: 'forward' as const, url: box.label }] : []),
                    ...(box.returnLabel ? [{ kind: 'return' as const, url: box.returnLabel }] : []),
                ],
            })),
            details,
        };
    }

    static async capture(
        page: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        evidence: LabelGenerationEvidence,
    ): Promise<void> {
        await allure.step('Capture verified label evidence', async () => {
            this.validateResult(page, evidence);

            await expect(
                orderToLabelPage.voidLabelsButton,
                'VOID SHIPPING LABELS must be visible after successful label generation',
            ).toBeVisible({ timeout: 15000 });
            await expect(orderToLabelPage.voidLabelsButton).toBeEnabled({ timeout: 10000 });

            const downloadedLabels = await this.downloadLabels(page, evidence);

            // URLs intentionally remain complete because these reports use isolated test data.
            await AllureHelper.attachJSON(page, 'Labels - Validated Result', evidence);
            for (const label of downloadedLabels) {
                await allure.attachment(label.attachmentName, label.content, 'application/pdf');
            }

            await AllureHelper.attachScreenShot(
                page,
                `PASS - Labels Generated - ${evidence.shipmentNumber}`,
                { fullPage: true, failOnError: true },
            );
            await AllureHelper.attachLocatorScreenshot(
                orderToLabelPage.voidLabelsButton,
                'UI proof - VOID SHIPPING LABELS available',
                { failOnError: true },
            );
        });
    }

    private static validateResult(page: Page, evidence: LabelGenerationEvidence): void {
        const currentShipment = new URL(page.url()).searchParams.get('shipment_number');
        expect(
            currentShipment,
            'The final evidence must belong to the shipment created by this test',
        ).toBe(evidence.shipmentNumber);
        expect(
            evidence.responseShipmentNumber,
            'The label response must belong to the shipment created by this test',
        ).toBe(evidence.shipmentNumber);
        expect(evidence.shipmentState, 'Shipment must be shipped after label generation').toBe('shipped');
        expect(evidence.boxes.length, 'At least one labeled box is required').toBeGreaterThan(0);

        const boxIndexes = evidence.boxes.map((box) => box.boxIndex);
        expect(new Set(boxIndexes).size, 'Every evidence box must have a unique index').toBe(boxIndexes.length);

        for (const box of evidence.boxes) {
            expect(Number.isInteger(box.boxIndex), 'Box index must be an integer').toBe(true);
            expect(box.boxIndex, 'Box index must be a positive integer').toBeGreaterThan(0);
            expect(box.trackingNumber, `Box ${box.boxIndex} must have a tracking number`).toBeTruthy();
            expect(box.documents.length, `Box ${box.boxIndex} must have at least one label`).toBeGreaterThan(0);

            if (box.state) {
                expect(box.state, `Box ${box.boxIndex} must be shipped`).toBe('shipped');
            }

            const kinds = box.documents.map((document) => document.kind);
            expect(
                new Set(kinds).size,
                `Box ${box.boxIndex} cannot contain duplicate label types`,
            ).toBe(kinds.length);

            for (const document of box.documents) {
                expect(
                    document.url,
                    `${document.kind} label for box ${box.boxIndex} must have an HTTP URL`,
                ).toMatch(/^https?:\/\//i);
            }
        }
    }

    private static async downloadLabels(
        page: Page,
        evidence: LabelGenerationEvidence,
    ): Promise<DownloadedLabel[]> {
        const downloads = evidence.boxes.flatMap((box) => box.documents.map(async (document) => {
            const labelUrl = new URL(document.url, page.url()).href;
            const response = await page.context().request.get(labelUrl);
            expect(
                response.ok(),
                `${document.kind} label for box ${box.boxIndex} failed with HTTP ${response.status()}`,
            ).toBe(true);

            const content = await response.body();
            expect(content.length, `${document.kind} label for box ${box.boxIndex} must not be empty`)
                .toBeGreaterThan(500);
            expect(
                content.subarray(0, 4).toString('ascii'),
                `${document.kind} label for box ${box.boxIndex} must be a real PDF document`,
            ).toBe('%PDF');

            const kindName = document.kind === 'return' ? 'Return' : 'Forward';
            return {
                attachmentName: `${kindName} Label PDF - ${evidence.shipmentNumber} - Box ${box.boxIndex}`,
                content,
            };
        }));

        return Promise.all(downloads);
    }
}
