import * as allure from 'allure-js-commons';
import { ProductDimensions, RecipientData } from '../../lib/test-data';
import { OrderCreationPort } from '../domain/orders/order-creation-port';

/** Order use cases independent from Playwright, PrimeNG or HTTP. */
export class OrderService {
    constructor(private readonly orderCreation: OrderCreationPort) {}

    async createStandardOrder(
        recipient: RecipientData,
        pkg: ProductDimensions,
        warehouse: string,
    ): Promise<string> {
        return allure.step('3. Create New Order', async () => this.orderCreation.createStandardOrder({
            recipient,
            package: pkg,
            warehouse,
        }));
    }
}
