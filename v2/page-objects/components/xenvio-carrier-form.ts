import { Locator, Page } from '@playwright/test';
import BasePage from '../../../lib/basepage';

/**
 * Component: Carrier credentials form (v2 — Angular)
 *
 * Source: x5.angular wizard/carriers → form-carrier.component.html
 *
 * Name and Description are fixed fields; the credential fields are dynamic and depend on
 * the carrier, so they are located by formControlName (see fillDynamicField).
 */
export class XenvioCarrierForm extends BasePage {

    readonly nameInput: Locator;
    readonly descriptionInput: Locator;

    constructor(page: Page) {
        super(page);

        this.nameInput = page.locator('input[formcontrolname="name"]').first();
        this.descriptionInput = page.locator('input[formcontrolname="description"]').first();
    }

    /**
     * Fill the carrier Name field.
     * Source: form-carrier.component.html → input[formControlName="name"]
     */
    async fillCarrierName(name: string): Promise<void> {
        console.log(`Filling carrier name: ${name}...`);
        await this.waitForElementToBeVisible(this.nameInput, 10000);
        await this.nameInput.fill(name);
        console.log(`  → Carrier name filled: ${name}`);
    }

    /**
     * Fill the carrier Description field.
     * Source: form-carrier.component.html → input[formControlName="description"]
     */
    async fillCarrierDescription(description: string): Promise<void> {
        console.log(`Filling carrier description: ${description}...`);
        await this.waitForElementToBeVisible(this.descriptionInput, 10000);
        await this.descriptionInput.fill(description);
        console.log(`  → Carrier description filled: ${description}`);
    }

    /**
     * Fill a dynamic credential field by its mat-label text.
     * Source: form-carrier.component.html → dynamic @for loop rendering mat-form-field
     * with [formControlName]="field.id.toString()" and mat-label="{{ field.label || field.name }}"
     *
     * These fields are generated dynamically based on the carrier type, so we find
     * them by label text rather than a fixed formControlName.
     *
     * @param labelText The label visible on the form (e.g. "EZ Carrier Account", "API Key")
     * @param value The value to fill
     */
    async fillDynamicField(labelText: string, value: string): Promise<void> {
        console.log(`Filling dynamic field "${labelText}"...`);

        // Strategy 1: Find mat-form-field containing the label, then fill the input inside
        const matFormField = this.page.locator('mat-form-field').filter({
            has: this.page.locator('mat-label', { hasText: new RegExp(labelText, 'i') })
        }).first();

        if (await this.isElementVisible(matFormField, 5000)) {
            const input = matFormField.locator('input, textarea, mat-select').first();
            await this.waitForElementToBeVisible(input, 5000);
            await input.fill(value);
            console.log(`  → Dynamic field "${labelText}" filled`);
            return;
        }

        // Strategy 2: Find by placeholder
        const byPlaceholder = this.page.locator(`input[placeholder*="${labelText}" i]`).first();
        if (await this.isElementVisible(byPlaceholder, 3000)) {
            await byPlaceholder.fill(value);
            console.log(`  → Dynamic field "${labelText}" filled (via placeholder)`);
            return;
        }

        // Strategy 3: Find by aria-label / role
        const byRole = this.page.getByRole('textbox', { name: new RegExp(labelText, 'i') }).first();
        await this.waitForElementToBeVisible(byRole, 5000);
        await byRole.fill(value);
        console.log(`  → Dynamic field "${labelText}" filled (via role)`);
    }

    /**
     * Fill all carrier configuration form fields at once.
     * Fixed fields: name, description
     * Dynamic fields: any additional credential fields (e.g. EZ Carrier Account, API Key)
     */
    async fillCarrierForm(data: {
        name: string;
        description: string;
        dynamicFields?: { label: string; value: string }[];
    }): Promise<void> {
        console.log('Filling carrier configuration form...');
        await this.fillCarrierName(data.name);
        await this.fillCarrierDescription(data.description);

        if (data.dynamicFields) {
            for (const field of data.dynamicFields) {
                await this.fillDynamicField(field.label, field.value);
            }
        }
        console.log('✅ Carrier form filled successfully');
    }

}
