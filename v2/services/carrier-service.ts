import { Page, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';
import AllureHelper from '../../lib/allure-helper';
import { XenvioCarrierConfigPage } from '../page-objects/xenvio-carrier-config-page';

export interface CarrierConfiguration {
    searchName: string;
    displayName: string;
    name: string;
    description: string;
    credentials: Record<string, string>;
}

/** Owns carrier configuration and verification use cases. */
export class CarrierService {
    static async openConfiguration(
        popupPage: Page,
        carrierPage: XenvioCarrierConfigPage,
        warehouse: string,
        step = '2',
    ): Promise<void> {
        await allure.step(`${step}. Open Configuration → Carriers`, async () => {
            await carrierPage.clickConfigMenuButton();
            await carrierPage.clickConfigurationMenuItem();
            await carrierPage.selectLocation(warehouse);
            await carrierPage.clickCarriersStep();
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    static async create(
        popupPage: Page,
        carrierPage: XenvioCarrierConfigPage,
        configuration: CarrierConfiguration,
        step = '3',
    ): Promise<void> {
        await allure.step(`${step}. Configure carrier: ${configuration.displayName}`, async () => {
            await carrierPage.searchCarrier(configuration.searchName);
            await carrierPage.selectCarrier(configuration.displayName);
            await carrierPage.fillCarrierForm({
                name: configuration.name,
                description: configuration.description,
                dynamicFields: Object.entries(configuration.credentials).map(([label, value]) => ({
                    label,
                    value,
                })),
            });
            await carrierPage.clickSave();
            await AllureHelper.attachScreenShot(popupPage);
        });
    }

    static async verifyCreated(
        popupPage: Page,
        carrierPage: XenvioCarrierConfigPage,
        carrierName: string,
        step = '4',
    ): Promise<void> {
        await allure.step(`${step}. Verify carrier in configured list`, async () => {
            await carrierPage.clickSeeCarriersConfigured();
            const isVisible = await carrierPage.isCarrierVisibleInList(carrierName);
            expect(isVisible, `Carrier "${carrierName}" must be visible`).toBe(true);
            await AllureHelper.attachScreenShot(popupPage);
        });
    }
}
