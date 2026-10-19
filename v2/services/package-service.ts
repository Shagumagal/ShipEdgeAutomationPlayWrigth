import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from "../evidence/allure-helper";
import { InternationalItemData, ProductDimensions } from "../test-data";
import { captureTaskExecutorResponse } from '../infrastructure/network-capture';
import { logShipmentState } from '../parsers/shipment-state-logger';
import { findItemMismatches, type ExpectedBoxItem } from '../parsers/shipment-items';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    createDomesticItemForBox,
    type DomesticItemData,
    validateDomesticPackagePlan,
} from '../domain/packages/domestic-package-plan';

export type { DomesticItemData } from '../domain/packages/domestic-package-plan';

/** Owns item and box preparation for domestic and international shipments. */
export class PackageService {
    static async addItemDetails(
        orderToLabelPage: XenvioOrderToLabelPage,
        item: DomesticItemData,
    ): Promise<void> {
        await allure.step('Add Item Details', async () => {
            await orderToLabelPage.boxForm.clickAddItem();
            await AllureHelper.attachScreenShot(orderToLabelPage.page, 'Item modal open');
            const qty = item.qty || '1';
            await orderToLabelPage.boxForm.fillItemDetails({ ...item, qty });

            const responseBody = await PackageService.applyItemAndConfirm(orderToLabelPage, [
                { box: 1, sku: item.sku, quantity: Number(qty) },
            ]);
            logShipmentState(responseBody, item);
            await AllureHelper.attachJSON(orderToLabelPage.page, 'Shipment State After Item', responseBody);

            await AllureHelper.attachScreenShot(orderToLabelPage.page, 'Item added to the box');
        });
    }

    static async setupDomesticMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        pkg: ProductDimensions,
        itemData?: DomesticItemData,
    ): Promise<void> {
        const item = itemData ?? createDomesticItemForBox(pkg);

        validateDomesticPackagePlan({ box: pkg, item });

        await allure.step(
            `Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`,
            async () => {
                for (let i = 2; i <= boxesCount; i++) {
                    console.log(`  📦 Creating Box #${i}...`);
                    await orderToLabelPage.boxForm.clickAddBox();
                    await orderToLabelPage.boxForm.fillBoxForm(
                        `${i}`,
                        pkg.weight,
                        pkg.length,
                        pkg.width,
                        pkg.height,
                    );
                    await orderToLabelPage.boxForm.clickApplyBox();

                    if (i === boxesCount) {
                        console.log('  ⏳ Waiting for Xenvio loading spinner after the final box creation...');
                        await orderToLabelPage.waitForXenvioLoading(30000);
                    }
                }
                console.log(`✅ All ${boxesCount} boxes created`);
                await AllureHelper.attachScreenShot(popupPage, 'Boxes created');
            },
        );

        await allure.step(
            `Add Items to all ${boxesCount} Boxes`,
            async () => {
                for (let i = 1; i <= boxesCount; i++) {
                    const sku = `${item.sku}-${i}`;
                    console.log(`  📝 Adding Item SKU: ${sku} to Box #${i}...`);
                    await orderToLabelPage.waitForXenvioLoading(15000);
                    await orderToLabelPage.boxForm.clickAddItemForBox(i - 1);
                    await orderToLabelPage.boxForm.fillItemDetails({
                        ...item,
                        sku,
                    });

                    if (i === boxesCount) {
                        console.log('  📡 Capturing task_executor response for the final item...');
                        const everyBox = Array.from({ length: boxesCount }, (_, index): ExpectedBoxItem => ({
                            box: index + 1,
                            sku: `${item.sku}-${index + 1}`,
                            quantity: Number(item.qty),
                        }));
                        const responseBody = await PackageService.applyItemAndConfirm(orderToLabelPage, everyBox);
                        logShipmentState(responseBody, item);
                        await AllureHelper.attachJSON(popupPage, 'Shipment State After All Items', responseBody);
                    } else {
                        await orderToLabelPage.boxForm.clickApplyItem();
                    }
                }
                console.log(`✅ All ${boxesCount} items added`);
                await AllureHelper.attachScreenShot(popupPage, 'Items added to every box');
            },
        );
    }

    static async setupInternationalMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        item: InternationalItemData,
        boxWeight = '5',
    ): Promise<void> {
        await allure.step(
            `a. Create ${boxesCount - 1} additional boxes (2–${boxesCount})`,
            async () => {
                for (let i = 2; i <= boxesCount; i++) {
                    console.log(`  📦 Creating Box #${i}...`);
                    await orderToLabelPage.boxForm.clickAddBox();
                    await orderToLabelPage.boxForm.fillBoxForm(
                        `${i}`,
                        boxWeight,
                        item.length,
                        item.width,
                        item.height,
                    );
                    await orderToLabelPage.boxForm.clickApplyBox();

                    if (i === boxesCount) {
                        await orderToLabelPage.waitForXenvioLoading(30000);
                    }
                }
                console.log(`✅ All ${boxesCount} boxes ready`);
                await AllureHelper.attachScreenShot(popupPage, 'International boxes created');
            },
        );

        await allure.step(
            `b. Add international item to each of the ${boxesCount} boxes`,
            async () => {
                for (let i = 0; i < boxesCount; i++) {
                    const boxNumber = i + 1;
                    const sku = `intl-sku-${boxNumber}`;

                    console.log(`  📝 Adding international item to Box #${boxNumber} (SKU: ${sku})...`);
                    await orderToLabelPage.waitForXenvioLoading(15000);
                    await orderToLabelPage.boxForm.clickAddItemForBox(i);
                    await AllureHelper.attachScreenShot(popupPage, 'International item modal open');
                    await orderToLabelPage.boxForm.fillInternationalItemDetails({
                        sku,
                        weight: item.weight,
                        length: item.length,
                        width: item.width,
                        height: item.height,
                        itemDescription: item.itemDescription,
                        harmonizationCode: item.harmonizationCode,
                        countryOfOrigin: item.countryOfOrigin,
                        unitPrice: item.unitPrice,
                        qty: item.qty,
                    });

                    if (boxNumber === boxesCount) {
                        console.log('  📡 Capturing task_executor response for the final international item...');
                        const everyBox = Array.from({ length: boxesCount }, (_, index): ExpectedBoxItem => ({
                            box: index + 1,
                            sku: `intl-sku-${index + 1}`,
                            quantity: Number(item.qty),
                        }));
                        const responseBody = await PackageService.applyItemAndConfirm(orderToLabelPage, everyBox);
                        logShipmentState(responseBody);
                        await AllureHelper.attachJSON(popupPage, 'Shipment State After All Intl Items', responseBody);
                    } else {
                        await orderToLabelPage.boxForm.clickApplyItem();
                    }

                    console.log(`  ✅ Box #${boxNumber} — international item applied`);
                }

                console.log(`✅ All ${boxesCount} international items added`);
                await AllureHelper.attachScreenShot(popupPage, 'International items added');
            },
        );
    }

    /**
     * Clicks Apply on the item modal and waits for Xenvio to save it: the task_executor response
     * must be for the open shipment and have every expected item in its box with its quantity.
     * Otherwise the step fails here instead of reporting "Item added" and failing later at rates.
     */
    private static async applyItemAndConfirm(
        orderToLabelPage: XenvioOrderToLabelPage,
        expectedItems: ExpectedBoxItem[],
    ): Promise<object> {
        const responseBody = await captureTaskExecutorResponse(
            orderToLabelPage.page,
            () => orderToLabelPage.boxForm.clickApplyItem(),
            60000,
        );
        if (!responseBody) {
            throw new Error('Item not confirmed: Xenvio did not answer the save (task_executor) within 60s after "Apply"');
        }

        const problems = findItemMismatches(responseBody, {
            shipmentNumber: orderToLabelPage.shipmentNumber,
            items: expectedItems,
        });
        if (problems.length > 0) {
            throw new Error(`Item not confirmed: ${problems.join('; ')}`);
        }
        return responseBody;
    }
}
