import { Locator, Page } from '@playwright/test';
import BasePage from '../../../lib/basepage';

/**
 * Component: Configured carriers list (v2 — Angular)
 *
 * The sidebar list shown by "See carriers configured", used to verify that a carrier was
 * created and to open it.
 */
export class XenvioConfiguredCarrierList extends BasePage {

    readonly seeCarriersConfiguredButton: Locator;

    constructor(page: Page) {
        super(page);

        this.seeCarriersConfiguredButton = page.locator('button.wizard-btn')
            .filter({ hasText: /See carriers configured/i }).first();
    }

    /**
     * Click "See carriers configured" button in the footer.
     * Source: carrier-list.component.html → button.wizard-btn-primary "See carriers configured"
     */
    async clickSeeCarriersConfigured(): Promise<void> {
        console.log('Clicking "See carriers configured" button...');
        await this.waitForElementToBeVisible(this.seeCarriersConfiguredButton, 10000);
        await this.click(this.seeCarriersConfiguredButton);
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(15000);
        await this.page.waitForTimeout(1000);
        console.log('✅ Carriers configured list loaded');
    }

    /**
     * Click on a specific configured carrier by its exact display name in the sidebar.
     * Source: carrier-configuration.component.html → sidebar div with:
     *   <h4 ... title="USPS Carrier 2026-..." [title]="carrier.nombre"> {{ carrier.nombre }} </h4>
     *
     * Strategy:
     *   1. Find the <h4> by its `title` attribute (exact carrier name — most reliable)
     *   2. Scroll into view (list may be long)
     *   3. Click the parent <div> container (Angular's (click)="selectCarrier(carrier.id)" is on the div)
     *   4. Wait for the right panel to show the carrier form (confirms selection worked)
     *
     * @param carrierName The exact name of the carrier (e.g. "USPS Carrier 2026-08-18_14h04")
     */
    async clickConfiguredCarrier(carrierName: string): Promise<void> {
        console.log(`Selecting configured carrier: "${carrierName}"...`);

        // Strategy 1: find h4 by title attribute (exact match — most resilient)
        let carrierH4 = this.page.locator(`h4[title="${carrierName}"]`).first();

        if (!(await this.isElementVisible(carrierH4, 5000))) {
            // Strategy 2: find h4 with matching text content (fallback if title attr changes)
            console.log('  → title attr not found, falling back to text content...');
            carrierH4 = this.page.locator('h4').filter({ hasText: carrierName }).first();
        }

        await this.waitForElementToBeVisible(carrierH4, 15000);
        await carrierH4.scrollIntoViewIfNeeded();
        console.log(`  → Found carrier h4, scrolled into view`);

        // Click the parent div container (Angular binds the click handler on the div, not the h4)
        const parentDiv = carrierH4.locator('..');
        await parentDiv.click();

        // Wait for the right panel to load the carrier's form (confirms selection)
        await this.page.waitForLoadState('networkidle');
        await this.waitForXenvioLoading(10000);

        // Verify the right panel shows the selected carrier's name
        const formNameInput = this.page.locator('input[formcontrolname="name"]').first();
        if (await this.isElementVisible(formNameInput, 5000)) {
            const formValue = await formNameInput.inputValue().catch(() => '');
            if (formValue.includes(carrierName) || carrierName.includes(formValue)) {
                console.log(`✅ Carrier "${carrierName}" selected — form loaded with matching name`);
            } else {
                console.log(`⚠️ Form loaded but name is "${formValue}" (expected "${carrierName}") — proceeding`);
            }
        } else {
            console.log(`  → Form input not visible — carrier panel may use a different layout`);
        }

        await this.page.waitForTimeout(500);
        console.log(`✅ Configured carrier selected: ${carrierName}`);
    }

    // ─── Visibility Checks ───────────────────────────────────────

    /**
     * Check if a carrier with the given exact name is visible in the configured sidebar list.
     * Uses h4[title] first (exact), falls back to h4 text content.
     */
    async isCarrierVisibleInList(carrierName: string): Promise<boolean> {
        // Try exact title attribute first
        const byTitle = this.page.locator(`h4[title="${carrierName}"]`).first();
        if (await this.isElementVisible(byTitle, 5000)) {
            console.log(`  → Carrier "${carrierName}" found via h4[title]`);
            return true;
        }

        // Fallback: text content match
        const byText = this.page.locator('h4').filter({ hasText: carrierName }).first();
        if (await this.isElementVisible(byText, 5000)) {
            console.log(`  → Carrier "${carrierName}" found via h4 text`);
            return true;
        }

        console.log(`  ⚠️ Carrier "${carrierName}" NOT found in list`);
        return false;
    }
}
