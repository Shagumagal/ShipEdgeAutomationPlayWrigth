import * as allure from 'allure-js-commons';
import type { APIRequestContext } from '@playwright/test';
import { ProductOutcomeError } from '../domain/contracts/product-contracts';
import { readPdfText } from '../infrastructure/pdf-text';
import type { ShipmentDocument } from '../parsers/shipment-result-types';

/**
 * Shipment documents (commercial invoices, uploaded files) downloaded with the browser session:
 * attached to the report and read, so a test can check what was printed, not only that a file
 * exists. Injected as the `shipmentDocuments` fixture (lib/page-object-fixtures.ts).
 */
export class ShipmentDocumentService {
    constructor(private readonly request: Pick<APIRequestContext, 'get'>) {}

    /**
     * Downloads `document`, attaches the PDF and its text as `attachmentName`, and returns the text
     * items in reading order. A file that is not a PDF is a product outcome (the shipment lists a
     * broken document); a failed download is not.
     */
    async readPdf(document: ShipmentDocument, attachmentName: string): Promise<string[]> {
        return allure.step(`Read ${attachmentName}`, async () => {
            const response = await this.request.get(document.url);
            if (!response.ok()) {
                throw new Error(`${attachmentName}: downloading ${document.name} failed with HTTP ${response.status()}`);
            }

            const content = await response.body();
            if (content.subarray(0, 4).toString('latin1') !== '%PDF') {
                throw new ProductOutcomeError(`${attachmentName} (${document.name}) is not a PDF document`);
            }
            await allure.attachment(attachmentName, content, 'application/pdf');

            const text = await readPdfText(content);
            await allure.attachment(`${attachmentName} — text`, text.join('\n'), 'text/plain');
            return text;
        });
    }
}
