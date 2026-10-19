import { Locator, Page } from '@playwright/test';
import BasePage from '../base-page';
import { findFacilityCardIndex } from '../../domain/facilities/facility-match';

/**
 * Component: location (facility/warehouse) list of the Configuration wizard (v2).
 * Source: facility.component.html → mat-card with (click)="selectFacility(location)"
 *
 * Shared by every wizard flow that starts by choosing a location (carriers, best rate). It clicks
 * only the card named exactly like the warehouse (domain/facilities/facility-match.ts): a substring
 * match picks "clon de qa22" for "qa22" and configures the wrong location while the test still passes.
 */
export class XenvioFacilitySelector extends BasePage {

    readonly cards: Locator;

    constructor(page: Page) {
        super(page);
        this.cards = page.locator('mat-card');
    }

    async select(warehouseName: string): Promise<void> {
        console.log(`Selecting location/facility: ${warehouseName}...`);
        await this.waitForElementToBeVisible(this.cards.first(), 15000);

        // The list can still be filling in when the first card shows up, so retry until the exact
        // card is there; if it never is, the error lists the similar cards that did render.
        const deadline = Date.now() + 15000;
        let index: number;
        for (;;) {
            const cardTexts = await this.cards.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).innerText));
            try {
                index = findFacilityCardIndex(cardTexts, warehouseName);
                break;
            } catch (error) {
                if (Date.now() > deadline) throw error;
                await this.page.waitForTimeout(500);
            }
        }

        await this.click(this.cards.nth(index));
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log(`✅ Location selected: ${warehouseName}`);
    }
}
