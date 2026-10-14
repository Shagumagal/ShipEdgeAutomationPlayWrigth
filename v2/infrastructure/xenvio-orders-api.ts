import type { APIRequest, APIRequestContext } from '@playwright/test';
import type { XenvioApiConfig } from '../config/xenvio-config';

/**
 * Xenvio API v3 (`/api/v3`), authenticated with the user's Email + Token headers (Grape API).
 * Unlike XenvioApi it needs no browser session, so orders can be created before the UI opens.
 */
export class XenvioOrdersApi {
    private constructor(private readonly request: APIRequestContext) {}

    static async connect(apiRequest: APIRequest, config: XenvioApiConfig): Promise<XenvioOrdersApi> {
        const request = await apiRequest.newContext({
            baseURL: `${new URL(config.url).origin}/api/v3/`,
            extraHTTPHeaders: {
                Email: config.email,
                Token: config.token,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
        return new XenvioOrdersApi(request);
    }

    /** Raw answer of POST orders/new; the domain decides whether it succeeded (domain/orders/api-order.ts). */
    async createOrder(payload: unknown): Promise<unknown> {
        const response = await this.request.post('orders/new', { data: payload });
        if (response.status() >= 500 || [401, 403].includes(response.status())) {
            throw new Error(`POST /api/v3/orders/new → HTTP ${response.status()}: ${(await response.text()).slice(0, 300)}`);
        }
        return response.json();
    }

    async findWarehouseId(name: string): Promise<number> {
        const response = await this.request.get('fulfillment_locations');
        if (!response.ok()) throw new Error(`GET /api/v3/fulfillment_locations → HTTP ${response.status()}`);
        const { fulfillment_locations } = await response.json() as { fulfillment_locations: { id: number; name: string }[] };
        const warehouse = fulfillment_locations.find((candidate) => candidate.name === name);
        if (!warehouse) throw new Error(`Warehouse "${name}" not found in API v3`);
        return warehouse.id;
    }

    dispose(): Promise<void> {
        return this.request.dispose();
    }
}
