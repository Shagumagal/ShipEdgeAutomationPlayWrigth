import { Page } from '@playwright/test';
import { InternationalItemData, ProductDimensions, RecipientData, ReturnLabelData } from '../../lib/test-data';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    LabelService,
    OrderService,
    PackageService,
    SessionService,
    ShipmentConfigurationService,
    type GetLabelsResult,
    type ShipmentSearchContext,
    type VoidLabelResult,
    type XenvioSessionConfig,
} from '../services';

/**
 * Backward-compatible facade for the original v2 workflow API.
 *
 * New scenarios may import capability services from `v2/services` directly.
 * Existing scenarios remain unchanged while this facade delegates each use case
 * to the service that owns that business responsibility.
 */
export class XenvioWorkflows {
    static loginAndOpenShipperView(
        loginPage: XenvioLoginPage,
        dashboardPage: XenvioDashboardPage,
        config: XenvioSessionConfig,
    ): Promise<Page> {
        return SessionService.loginAndOpenShipperView(loginPage, dashboardPage, config);
    }

    static createStandardOrder(
        popupPage: Page,
        recipient: RecipientData,
        pkg: ProductDimensions,
        warehouse: string,
    ): Promise<string> {
        return OrderService.createStandardOrder(popupPage, recipient, pkg, warehouse);
    }

    static waitForShipmentDetailAfterCreation(
        popupPage: Page,
        shipmentNumber: string,
    ): Promise<XenvioOrderToLabelPage> {
        return OrderService.waitForShipmentDetailAfterCreation(popupPage, shipmentNumber);
    }

    static searchAndOpenShipment(
        popupPage: Page,
        shipmentNumber: string,
        context?: ShipmentSearchContext,
    ): Promise<XenvioOrderToLabelPage> {
        return OrderService.searchAndOpenShipment(popupPage, shipmentNumber, context);
    }

    static addItemDetails(
        orderToLabelPage: XenvioOrderToLabelPage,
        item: ProductDimensions & { sku: string; country: string; unitPrice: string },
    ): Promise<void> {
        return PackageService.addItemDetails(orderToLabelPage, item);
    }

    static setupDomesticMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        pkg: ProductDimensions,
        stepPrefix = '5',
    ): Promise<void> {
        return PackageService.setupDomesticMultiBox(
            popupPage,
            orderToLabelPage,
            boxesCount,
            pkg,
            stepPrefix,
        );
    }

    static setupInternationalMultiBox(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        boxesCount: number,
        item: InternationalItemData,
        boxWeight = '5',
        stepPrefix = '6',
    ): Promise<void> {
        return PackageService.setupInternationalMultiBox(
            popupPage,
            orderToLabelPage,
            boxesCount,
            item,
            boxWeight,
            stepPrefix,
        );
    }

    static configureReturnLabel(
        orderToLabelPage: XenvioOrderToLabelPage,
        returnLabelData: ReturnLabelData,
    ): Promise<void> {
        return ShipmentConfigurationService.configureReturnLabel(orderToLabelPage, returnLabelData);
    }

    static configureShipCode(
        orderToLabelPage: XenvioOrderToLabelPage,
        shipCode: string,
    ): Promise<void> {
        return ShipmentConfigurationService.configureShipCode(orderToLabelPage, shipCode);
    }

    static getLabelsAndCaptureResult(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 180000,
    ): Promise<GetLabelsResult> {
        return LabelService.generate(popupPage, orderToLabelPage, timeoutMs);
    }

    static voidLabelAndCaptureResult(
        popupPage: Page,
        orderToLabelPage: XenvioOrderToLabelPage,
        timeoutMs = 120000,
    ): Promise<VoidLabelResult> {
        return LabelService.void(popupPage, orderToLabelPage, timeoutMs);
    }

    static logShipmentState(responseBody: unknown, expectedPkg?: ProductDimensions): void {
        LabelService.logShipmentState(responseBody, expectedPkg);
    }
}
