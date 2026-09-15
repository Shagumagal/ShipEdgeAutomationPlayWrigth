import { Page } from '@playwright/test';
import { OrderService } from '../../services/order-service';
import { PrimeNgOrderCreationAdapter } from './primeng-order-creation-adapter';

/** Composition root for an OrderService backed by the PrimeNG UI. */
export function createPrimeNgOrderService(page: Page): OrderService {
    return new OrderService(new PrimeNgOrderCreationAdapter(page));
}
