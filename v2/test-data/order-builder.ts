import type { ProductDimensions, RecipientData } from '../../lib/test-data';
import type { DomesticItemData, DomesticPackagePlan } from '../domain/packages/domestic-package-plan';
import { PackageBuilder } from './package-builder';
import { RecipientBuilder } from './recipient-builder';

export interface DomesticOrderTestData {
    recipient: RecipientData;
    product: ProductDimensions;
    item: DomesticItemData;
    boxesCount: number;
}

/** Composes recipient and package builders into a reusable domestic order scenario. */
export class OrderBuilder {
    private constructor(private readonly value: DomesticOrderTestData) {}

    static domestic(): OrderBuilder {
        const packagePlan = PackageBuilder.standard().buildPlan();
        return new OrderBuilder({
            recipient: RecipientBuilder.randomUS().build(),
            product: packagePlan.box,
            item: packagePlan.item,
            boxesCount: 1,
        });
    }

    withRecipient(recipient: RecipientData): OrderBuilder {
        return new OrderBuilder({ ...this.value, recipient: { ...recipient } });
    }

    withProduct(product: ProductDimensions): OrderBuilder {
        const packagePlan = PackageBuilder.standard().with(product).buildPlan();
        return this.withPackagePlan(packagePlan);
    }

    withPackagePlan(packagePlan: DomesticPackagePlan): OrderBuilder {
        return new OrderBuilder({
            ...this.value,
            product: { ...packagePlan.box },
            item: { ...packagePlan.item },
        });
    }

    withBoxes(boxesCount: number): OrderBuilder {
        if (!Number.isInteger(boxesCount) || boxesCount < 1) {
            throw new Error(`boxesCount must be a positive integer; received ${boxesCount}`);
        }

        return new OrderBuilder({ ...this.value, boxesCount });
    }

    build(): DomesticOrderTestData {
        return {
            recipient: { ...this.value.recipient },
            product: { ...this.value.product },
            item: { ...this.value.item },
            boxesCount: this.value.boxesCount,
        };
    }
}
