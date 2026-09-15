import { Page } from '@playwright/test';
import { InternationalItemData, ProductDimensions, ReturnLabelData } from '../../lib/test-data';
import { createPrimeNgOrderService } from '../adapters/ui/service-factory';
import { XenvioConfig } from '../config/xenvio-config';
import { XenvioOrderToLabelPage } from '../page-objects/xenvio-order-to-label-page';
import {
    LabelService,
    PackageService,
    RatesService,
    ShipmentConfigurationService,
    ShipmentNavigationService,
    type DomesticItemData,
    type GetLabelsResult,
    type VoidLabelResult,
} from '../services';

class SessionShipmentService {
    constructor(
        private readonly page: Page,
        private readonly config: XenvioConfig,
    ) {}

    waitForDetailAfterCreation(shipmentNumber: string): Promise<XenvioOrderToLabelPage> {
        return ShipmentNavigationService.waitForDetailAfterCreation(this.page, shipmentNumber);
    }

    searchAndOpen(shipmentNumber: string): Promise<XenvioOrderToLabelPage> {
        return ShipmentNavigationService.searchAndOpen(this.page, shipmentNumber, {
            warehouse: this.config.warehouse,
            app: this.config.app,
        });
    }
}

class SessionPackageService {
    constructor(private readonly page: Page) {}

    addItemDetails(orderPage: XenvioOrderToLabelPage, item: DomesticItemData): Promise<void> {
        return PackageService.addItemDetails(orderPage, item);
    }

    setupDomesticMultiBox(
        orderPage: XenvioOrderToLabelPage,
        boxesCount: number,
        pkg: ProductDimensions,
        stepPrefix = '5',
    ): Promise<void> {
        return PackageService.setupDomesticMultiBox(
            this.page,
            orderPage,
            boxesCount,
            pkg,
            stepPrefix,
        );
    }

    setupInternationalMultiBox(
        orderPage: XenvioOrderToLabelPage,
        boxesCount: number,
        item: InternationalItemData,
        boxWeight = '5',
        stepPrefix = '6',
    ): Promise<void> {
        return PackageService.setupInternationalMultiBox(
            this.page,
            orderPage,
            boxesCount,
            item,
            boxWeight,
            stepPrefix,
        );
    }
}

class SessionRatesService {
    constructor(private readonly page: Page) {}

    request(orderPage: XenvioOrderToLabelPage, step = '6'): Promise<void> {
        return RatesService.request(this.page, orderPage, step);
    }

    selectFirstAndConfirm(
        orderPage: XenvioOrderToLabelPage,
        timeoutMs = 60000,
        step = '7',
    ): Promise<string> {
        return RatesService.selectFirstAndConfirm(this.page, orderPage, timeoutMs, step);
    }

    selectByTextAndConfirm(
        orderPage: XenvioOrderToLabelPage,
        rateText: string,
        step = '7',
    ): Promise<void> {
        return RatesService.selectByTextAndConfirm(this.page, orderPage, rateText, step);
    }
}

class SessionLabelService {
    constructor(private readonly page: Page) {}

    generate(orderPage: XenvioOrderToLabelPage, timeoutMs = 180000): Promise<GetLabelsResult> {
        return LabelService.generate(this.page, orderPage, timeoutMs);
    }

    void(orderPage: XenvioOrderToLabelPage, timeoutMs = 120000): Promise<VoidLabelResult> {
        return LabelService.void(this.page, orderPage, timeoutMs);
    }
}

class SessionShipmentConfigurationService {
    configureReturnLabel(orderPage: XenvioOrderToLabelPage, data: ReturnLabelData): Promise<void> {
        return ShipmentConfigurationService.configureReturnLabel(orderPage, data);
    }

    configureShipCode(orderPage: XenvioOrderToLabelPage, shipCode: string): Promise<void> {
        return ShipmentConfigurationService.configureShipCode(orderPage, shipCode);
    }
}

/** Services bound to one authenticated Shipper View page. */
export class XenvioSession {
    readonly orders;
    readonly shipments;
    readonly packages;
    readonly rates;
    readonly labels;
    readonly configuration;

    constructor(
        readonly page: Page,
        readonly config: XenvioConfig,
    ) {
        this.orders = createPrimeNgOrderService(page);
        this.shipments = new SessionShipmentService(page, config);
        this.packages = new SessionPackageService(page);
        this.rates = new SessionRatesService(page);
        this.labels = new SessionLabelService(page);
        this.configuration = new SessionShipmentConfigurationService();
    }
}
