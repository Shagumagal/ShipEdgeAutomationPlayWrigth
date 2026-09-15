import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { InternationalItemData, ProductDimensions } from '../../lib/test-data';
import { captureTaskExecutorResponse } from '../lib/network-capture';
import { logShipmentState } from '../lib/shipment-result-parser';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';

export type DomesticItemData = ProductDimensions & {
    sku: string;
    country: string;
    unitPrice: string;
};

/** Owns item and box preparation for domestic and international shipments. */
export class PackageService {
    static async addItemDetails(
        orderToLabelPage: XenvioOrderToLabelPage,
        item: DomesticItemData,
    ): Promise<void> {
        await allure.step('5. Add Item Details', async () => {
            await orderToLabelPage.boxForm.clickAddItem();
            await AllureHelper.attachScreenShot(orderToLabelPage.page);
            await orderToLabelPage.boxForm.fillItemDetails({ ...item, qty: item.qty || '1' });

            const responseBody = await captureTaskExecutorResponse(
                orderToLabelPage.page,
                () => orderToLabelPage.boxForm.clickApplyItem(),
                60000,
            );

            if (responseBody) {
                logShipmentState(responseBody, item);
                await AllureHelper.attachJSON(
                    orderToLabelPage.page,
                    'Shipment State After Item',
                    responseBody,
                );
            }

            await AllureHelper.attachScreenShot(orderToLabelPage.page);
        });
    }

    static async setupDomesticMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        pkg: ProductDimensions,
        stepPrefix = '5',
    ): Promise<void> {
        await allure.step(
            `${stepPrefix}a. Create ${boxesCount - 1} additional Boxes (2-${boxesCount})`,
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
                await AllureHelper.attachScreenShot(popupPage);
            },
        );

        await allure.step(
            `${stepPrefix}b. Add Items to all ${boxesCount} Boxes (SKU 1-${boxesCount})`,
            async () => {
                for (let i = 1; i <= boxesCount; i++) {
                    console.log(`  📝 Adding Item SKU: ${i} to Box #${i}...`);
                    await orderToLabelPage.waitForXenvioLoading(15000);
                    await orderToLabelPage.boxForm.clickAddItemForBox(i - 1);
                    await orderToLabelPage.boxForm.fillItemDetails({
                        sku: `${i}`,
                        weight: pkg.weight,
                        length: pkg.length,
                        width: pkg.width,
                        height: pkg.height,
                        country: 'us',
                        unitPrice: '1',
                        qty: pkg.qty,
                    });

                    if (i === boxesCount) {
                        console.log('  📡 Capturing task_executor response for the final item...');
                        const responseBody = await captureTaskExecutorResponse(
                            popupPage,
                            () => orderToLabelPage.boxForm.clickApplyItem(),
                            60000,
                        );

                        if (responseBody) {
                            logShipmentState(responseBody, pkg);
                            await AllureHelper.attachJSON(
                                popupPage,
                                'Shipment State After All Items',
                                responseBody,
                            );
                        }
                    } else {
                        await orderToLabelPage.boxForm.clickApplyItem();
                    }
                }
                console.log(`✅ All ${boxesCount} items added`);
                await AllureHelper.attachScreenShot(popupPage);
            },
        );
    }

    static async setupInternationalMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        item: InternationalItemData,
        boxWeight = '5',
        stepPrefix = '6',
    ): Promise<void> {
        await allure.step(
            `${stepPrefix}a. Create ${boxesCount - 1} additional boxes (2–${boxesCount})`,
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
                await AllureHelper.attachScreenShot(popupPage);
            },
        );

        await allure.step(
            `${stepPrefix}b. Add international item to each of the ${boxesCount} boxes`,
            async () => {
                for (let i = 0; i < boxesCount; i++) {
                    const boxNumber = i + 1;
                    const sku = `intl-sku-${boxNumber}`;

                    console.log(`  📝 Adding international item to Box #${boxNumber} (SKU: ${sku})...`);
                    await orderToLabelPage.waitForXenvioLoading(15000);
                    await orderToLabelPage.boxForm.clickAddItemForBox(i);
                    await AllureHelper.attachScreenShot(popupPage);
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
                        const responseBody = await captureTaskExecutorResponse(
                            popupPage,
                            () => orderToLabelPage.boxForm.clickApplyItem(),
                            60000,
                        );

                        if (responseBody) {
                            logShipmentState(responseBody);
                            await AllureHelper.attachJSON(
                                popupPage,
                                'Shipment State After All Intl Items',
                                responseBody,
                            );
                        }
                    } else {
                        await orderToLabelPage.boxForm.clickApplyItem();
                    }

                    console.log(`  ✅ Box #${boxNumber} — international item applied`);
                }

                console.log(`✅ All ${boxesCount} international items added`);
                await AllureHelper.attachScreenShot(popupPage);
            },
        );
    }
}
