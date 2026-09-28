import * as allure from 'allure-js-commons';
import { ProductDimensions, RecipientData } from "../test-data";
import { OrderCreationPort } from '../domain/orders/order-creation-port';

/** Order use cases independent from Playwright, PrimeNG or HTTP. */
export class OrderService {
    constructor(private readonly orderCreation: OrderCreationPort) {}

    async createStandardOrder(
        recipient: RecipientData,
        pkg: ProductDimensions,
        warehouse: string,
    ): Promise<string> {
        return allure.step('Create New Order', async () => this.orderCreation.createStandardOrder({
            recipient,
            package: pkg,
            warehouse,
        }));
    }
}
