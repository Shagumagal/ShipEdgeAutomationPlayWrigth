import { Page } from '@playwright/test';
import { CreateStandardOrderCommand, OrderCreationPort } from '../../domain/orders/order-creation-port';
import { XenvioNewOrderPage } from '../../page-objects/xenvio-new-order-page';

/** Creates orders through the PrimeNG user interface. */
export class PrimeNgOrderCreationAdapter implements OrderCreationPort {
    constructor(private readonly page: Page) {}

    async createStandardOrder(command: CreateStandardOrderCommand): Promise<string> {
        const newOrderPage = new XenvioNewOrderPage(this.page);
        const shipmentNumber = await newOrderPage.createOrderFlow(
            command.recipient,
            command.package,
            command.warehouse,
        );

        if (!shipmentNumber) {
            throw new Error('PrimeNG order creation completed without a shipment number');
        }

        return shipmentNumber;
    }
}
