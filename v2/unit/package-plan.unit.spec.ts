import { test, expect } from '@playwright/test';
import { StandardPackage } from '../../lib/test-data';
import {
    createDomesticItemForBox,
    validateDomesticPackagePlan,
    type DomesticPackagePlan,
} from '../domain/packages/domestic-package-plan';
import { OrderBuilder, PackageBuilder } from '../test-data';

function fits(plan: DomesticPackagePlan): boolean {
    return (['length', 'width', 'height'] as const).every(
        (dimension) => Number(plan.item[dimension]) <= Number(plan.box[dimension]),
    ) && Number(plan.item.weight) * Number(plan.item.qty) <= Number(plan.box.weight);
}

function validPlan(): DomesticPackagePlan {
    return PackageBuilder.standard().buildPlan();
}

test.describe('Coherencia item / caja', { tag: ['@unit', '@packages'] }, () => {

    test('el item derivado de StandardPackage es proporcional y cabe en la caja', () => {
        const item = createDomesticItemForBox(StandardPackage);
        expect(item).toMatchObject({ length: '6', width: '4', height: '3', weight: '2', qty: '1', country: 'US' });
        expect(() => validateDomesticPackagePlan({ box: StandardPackage, item })).not.toThrow();
    });

    test('rechaza un item más pesado que la caja (considerando cantidad)', () => {
        const plan = validPlan();
        plan.item = { ...plan.item, weight: '3', qty: '2' };
        expect(() => validateDomesticPackagePlan(plan)).toThrow(/cannot exceed box weight/);
    });

    for (const dimension of ['length', 'width', 'height'] as const) {
        test(`rechaza un item con ${dimension} mayor que la caja`, () => {
            const plan = validPlan();
            plan.item = { ...plan.item, [dimension]: String(Number(plan.box[dimension]) + 1) };
            expect(() => validateDomesticPackagePlan(plan)).toThrow(new RegExp(`item.${dimension}`));
        });
    }

    test('rechaza valores no positivos o no numéricos', () => {
        for (const bad of ['0', '-1', 'abc', '']) {
            const plan = validPlan();
            plan.box = { ...plan.box, weight: bad };
            expect(() => validateDomesticPackagePlan(plan), `box.weight="${bad}"`).toThrow(/positive number/);
        }
    });

    test('exige sku y país', () => {
        const noSku = validPlan();
        noSku.item = { ...noSku.item, sku: '  ' };
        expect(() => validateDomesticPackagePlan(noSku)).toThrow(/sku/);

        const noCountry = validPlan();
        noCountry.item = { ...noCountry.item, country: '' };
        expect(() => validateDomesticPackagePlan(noCountry)).toThrow(/country/);
    });

    test('PackageBuilder.random() siempre produce un plan coherente (500 iteraciones)', () => {
        for (let i = 0; i < 500; i++) {
            const plan = PackageBuilder.random().buildPlan();
            expect(fits(plan), JSON.stringify(plan)).toBe(true);
        }
    });

    test('los presets standard, small y carrierSafeMultiBox son coherentes', () => {
        for (const builder of [PackageBuilder.standard(), PackageBuilder.small(), PackageBuilder.carrierSafeMultiBox()]) {
            const plan = builder.buildPlan();
            expect(fits(plan), JSON.stringify(plan)).toBe(true);
        }
    });

    test('with() recalcula el item para que siga cabiendo en la caja nueva', () => {
        const plan = PackageBuilder.standard().with({ length: '4', width: '3', height: '2', weight: '1' }).buildPlan();
        expect(fits(plan), JSON.stringify(plan)).toBe(true);
    });

    test('withItem() con un item que no cabe falla antes de tocar la UI', () => {
        expect(() => PackageBuilder.small().withItem({ length: '50' }).buildPlan()).toThrow(/item.length/);
    });
});

test.describe('OrderBuilder', { tag: ['@unit', '@orders'] }, () => {

    test('domestic() arma un pedido con item que cabe en su caja', () => {
        const order = OrderBuilder.domestic().build();
        expect(fits({ box: order.product, item: order.item })).toBe(true);
        expect(order.boxesCount).toBe(1);
        expect(order.recipient.country).toBe('us');
    });

    test('withBoxes() rechaza valores inválidos', () => {
        for (const bad of [0, -1, 1.5]) {
            expect(() => OrderBuilder.domestic().withBoxes(bad)).toThrow(/positive integer/);
        }
    });

    test('build() devuelve copias: modificar el resultado no altera los presets compartidos', () => {
        const order = OrderBuilder.domestic().build();
        order.product.weight = '999';
        order.item.sku = 'MUTADO';
        expect(StandardPackage.weight).toBe('5');
        expect(OrderBuilder.domestic().build().item.sku).not.toBe('MUTADO');
    });
});
