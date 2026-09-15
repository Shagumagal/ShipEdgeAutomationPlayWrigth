import { ProductDimensions, RecipientData } from '../../../lib/test-data';

export interface CreateStandardOrderCommand {
    recipient: RecipientData;
    package: ProductDimensions;
    warehouse: string;
}

/** Contract implemented by UI or API order-creation adapters. */
export interface OrderCreationPort {
    createStandardOrder(command: CreateStandardOrderCommand): Promise<string>;
}
