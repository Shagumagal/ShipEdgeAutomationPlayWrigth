/**
 * Text of a PDF document with pdfjs-dist (Mozilla PDF.js), in reading order: one entry per text
 * item, trimmed, blanks dropped. A PDF whose content is a picture (e.g. the USPS international
 * label, an image wrapped in a PDF) has no text: the result is empty, never a guess.
 */
interface PdfJs {
    getDocument(source: { data: Uint8Array; isEvalSupported: boolean; useSystemFonts: boolean }): {
        promise: Promise<{
            numPages: number;
            getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str?: string }> }> }>;
        }>;
        destroy(): Promise<void>;
    };
}

export async function readPdfText(content: Uint8Array): Promise<string[]> {
    // ESM-only package: loaded on demand, so specs that never read a PDF do not pay for it
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as PdfJs;
    // pdf.js takes ownership of the bytes it gets: give it a copy, the caller may still use them
    const loading = pdfjs.getDocument({ data: new Uint8Array(content), isEvalSupported: false, useSystemFonts: false });
    try {
        const document = await loading.promise;
        const items: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
            const page = await document.getPage(pageNumber);
            const { items: pageItems } = await page.getTextContent();
            for (const item of pageItems) {
                const text = item.str?.trim();
                if (text) items.push(text);
            }
        }
        return items;
    } finally {
        await loading.destroy();
    }
}
