import { Page } from "@playwright/test";
import BasePage from "../base-page";

/**
 * Component: Shipment detail reader (v2 — PrimeNG)
 *
 * Reads what the shipment detail shows: order fields, the selected rate and the label task
 * result. `captureTaskLabelResult` is the UI fallback used when the network capture of
 * task_executor returns nothing (see workflows/get-labels-workflow.ts).
 */
export class XenvioShipmentDetailReader extends BasePage {

    constructor(page: Page) {
        super(page);
    }

    async getOrderDetailsData(): Promise<Record<string, string>> {
        console.log('Capturing Order details...');
        const details: Record<string, string> = {};
        const labels = ['Order number', 'Shipment number', 'Status'];

        for (const label of labels) {
            const input = this.page
                .locator('mat-form-field')
                .filter({ hasText: new RegExp(label, 'i') })
                .locator('input')
                .first();
            if (await this.isElementVisible(input, 2000)) {
                details[label] = await input.inputValue();
            }
        }

        console.log(`📋 Order details: ${JSON.stringify(details)}`);
        return details;
    }

    async getSelectedRate(): Promise<{ price: string | null; carrier: string | null }> {
        const priceEl = this.page.locator('.text-green-600, [class*="text-green"]').first();
        const carrierEl = this.page.locator('.text-xl.font-bold, [class*="carrier-name"]').first();

        const price = await this.isElementVisible(priceEl, 2000) ? await priceEl.textContent() : null;
        const carrier = await this.isElementVisible(carrierEl, 2000) ? await carrierEl.textContent() : null;

        console.log(`💰 Selected rate: ${price ?? 'N/A'} | Carrier: ${carrier ?? 'N/A'}`);
        return { price: price?.trim() ?? null, carrier: carrier?.trim() ?? null };
    }

    // ─── Task Label Result Capture ────────────────────────────────────

    async captureTaskLabelResult(): Promise<{
        finalPostage: number | null;
        shippingCost: number | null;
        labelUrls: string[];
        docUrls: string[];
    }> {
        console.log('\n📬 Capturing label task result...');

        const result = {
            finalPostage: null as number | null,
            shippingCost: null as number | null,
            labelUrls: [] as string[],
            docUrls: [] as string[],
        };

        try {
            const taskPanel = this.page.locator(
                '[class*="task"], [id*="task"], pre, code, .json-viewer, mat-card'
            ).filter({ hasText: /finalPostage|shippingCost|task_executor/i }).first();

            if (await this.isElementVisible(taskPanel, 5000)) {
                const rawText = await taskPanel.textContent();
                if (rawText) {
                    const finalPostageMatch = rawText.match(/"finalPostage"\s*:\s*([\d.]+)/);
                    const shippingCostMatch = rawText.match(/"shippingCost"\s*:\s*([\d.]+)/);
                    if (finalPostageMatch) result.finalPostage = parseFloat(finalPostageMatch[1]);
                    if (shippingCostMatch) result.shippingCost = parseFloat(shippingCostMatch[1]);

                    const labelUrlMatches = [...rawText.matchAll(/https?:\/\/[^\s"]+\.pdf[^\s"]*/gi)];
                    for (const m of labelUrlMatches) {
                        const url = m[0].replace(/[",]/g, '').trim();
                        if (url.includes('invoice') || url.includes('commercial')) {
                            result.docUrls.push(url);
                        } else {
                            result.labelUrls.push(url);
                        }
                    }
                }
            }
        } catch {
            console.log('  ⚠ Could not read task panel text directly');
        }

        if (result.labelUrls.length === 0 && result.docUrls.length === 0) {
            try {
                const pdfLinks = await this.page.locator('a[href*=".pdf"]').all();
                for (const link of pdfLinks) {
                    const href = await link.getAttribute('href') ?? '';
                    if (!href) continue;
                    const fullUrl = href.startsWith('http') ? href : `${this.page.url().split('/').slice(0, 3).join('/')}${href}`;
                    if (fullUrl.toLowerCase().includes('invoice') || fullUrl.toLowerCase().includes('commercial')) {
                        result.docUrls.push(fullUrl);
                    } else {
                        result.labelUrls.push(fullUrl);
                    }
                }
            } catch {
                console.log('  ⚠ Could not capture PDF anchor links');
            }
        }

        console.log('\n══════════════════════════════════════════════');
        console.log('  📦 LABEL TASK RESULT');
        console.log('══════════════════════════════════════════════');
        console.log(`  💰 finalPostage  : ${result.finalPostage ?? 'N/A'}`);
        console.log(`  💳 shippingCost  : ${result.shippingCost ?? 'N/A'}`);

        if (result.labelUrls.length > 0) {
            console.log('\n  🏷️  LABEL URL(s)  — CMD+Click to open:');
            result.labelUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
        }
        if (result.docUrls.length > 0) {
            console.log('\n  📄  DOCUMENT URL(s) — CMD+Click to open:');
            result.docUrls.forEach((url, i) => console.log(`     [${i + 1}] ${url}`));
        }
        console.log('══════════════════════════════════════════════\n');

        return result;
    }
}
