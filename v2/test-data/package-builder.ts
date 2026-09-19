import {
    generateProductDimensions,
    SmallPackage,
    StandardPackage,
    type ProductDimensions,
} from '../../lib/test-data';
import {
    createDomesticItemForBox,
    type DomesticItemData,
    type DomesticPackagePlan,
    validateDomesticPackagePlan,
} from '../domain/packages/domestic-package-plan';

/** Builds package dimensions while preserving the project's known-safe defaults. */
export class PackageBuilder {
    private constructor(private readonly value: DomesticPackagePlan) {}

    static standard(): PackageBuilder {
        const box = { ...StandardPackage };
        return new PackageBuilder({ box, item: createDomesticItemForBox(box) });
    }

    static small(): PackageBuilder {
        const box = { ...SmallPackage };
        return new PackageBuilder({ box, item: createDomesticItemForBox(box) });
    }

    /** Stable dimensions and contents intended for common USPS/UPS/FedEx rate requests. */
    static carrierSafeMultiBox(): PackageBuilder {
        const box: ProductDimensions = {
            qty: '1',
            length: '10',
            width: '8',
            height: '6',
            weight: '5',
        };

        return new PackageBuilder({
            box,
            item: {
                sku: 'QA-MULTIBOX-ITEM',
                qty: '1',
                length: '6',
                width: '4',
                height: '2',
                weight: '2',
                country: 'US',
                unitPrice: '20',
            },
        });
    }

    static random(): PackageBuilder {
        const box = generateProductDimensions();
        return new PackageBuilder({ box, item: createDomesticItemForBox(box) });
    }

    with(overrides: Partial<ProductDimensions>): PackageBuilder {
        const box = { ...this.value.box, ...overrides };
        return new PackageBuilder({ box, item: createDomesticItemForBox(box, this.value.item.sku) });
    }

    withItem(overrides: Partial<DomesticItemData>): PackageBuilder {
        return new PackageBuilder({
            box: { ...this.value.box },
            item: { ...this.value.item, ...overrides },
        });
    }

    build(): ProductDimensions {
        return { ...this.value.box };
    }

    buildPlan(): DomesticPackagePlan {
        const plan = {
            box: { ...this.value.box },
            item: { ...this.value.item },
        };
        validateDomesticPackagePlan(plan);
        return plan;
    }
}
