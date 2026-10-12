import type { APIRequestContext } from '@playwright/test';

/** Headers the Angular app sends on every call (x5.angular core/interceptors/http.interceptor.ts). */
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export interface XenvioRecord {
    id: number;
    name: string;
}

/**
 * Xenvio backend JSON endpoints, called with the logged-in browser session: the same cookies
 * the Angular app sends, so no API token is needed (the carrier and best rate controllers only
 * accept the session anyway). Build it with `context.request` so it shares the test's cookies.
 *
 * Used to clean up the configuration that tests create (see runtime/test-data-registry.ts).
 */
export class XenvioApi {
    private readonly baseUrl: string;

    /** @param xenvioUrl any URL of the Xenvio backend, e.g. XENVIO_URL (only its origin is used). */
    constructor(private readonly request: APIRequestContext, xenvioUrl: string) {
        this.baseUrl = new URL(xenvioUrl).origin;
    }

    async findWarehouseId(name: string): Promise<number> {
        const { warehouses } = await this.send<{ warehouses: XenvioRecord[] }>('GET', '/warehouses');
        const warehouse = warehouses.find((candidate) => candidate.name === name);
        if (!warehouse) throw new Error(`Warehouse "${name}" not found in Xenvio`);
        return warehouse.id;
    }

    async listCarrierAccounts(warehouseId: number): Promise<XenvioRecord[]> {
        const { carrier_accounts } = await this.send<{ carrier_accounts: XenvioRecord[] }>(
            'POST',
            '/carrier_accounts/search_by_warehouse',
            { carrier_account: { warehouse_id: warehouseId } },
        );
        return carrier_accounts;
    }

    /** Apps belong to the account, not to a warehouse. */
    listApps(): Promise<XenvioRecord[]> {
        return this.send<XenvioRecord[]>('GET', '/apps');
    }

    async listBestRates(warehouseId: number): Promise<XenvioRecord[]> {
        const { best_rates } = await this.send<{ best_rates: XenvioRecord[] }>(
            'GET',
            `/best_rates?warehouse_id=${warehouseId}`,
        );
        return best_rates;
    }

    /** Hard delete; also removes its shipping codes, rates, credentials and webhooks. */
    async deleteCarrierAccount(id: number): Promise<void> {
        await this.send('DELETE', `/carrier_accounts/${id}`);
    }

    /** Soft delete (acts_as_paranoid). Requires an admin user. */
    async deleteApp(id: number): Promise<void> {
        await this.send('DELETE', `/apps/${id}`);
    }

    /** Soft delete (acts_as_paranoid). */
    async deleteBestRate(id: number): Promise<void> {
        await this.send('DELETE', `/best_rates/${id}`);
    }

    private async send<T = unknown>(method: string, path: string, data?: unknown): Promise<T> {
        const response = await this.request.fetch(this.baseUrl + path, { method, headers: JSON_HEADERS, data });
        const body = await response.text();
        if (!response.ok()) {
            throw new Error(`${method} ${path} → HTTP ${response.status()}: ${body.slice(0, 200)}`);
        }
        return (body ? JSON.parse(body) : null) as T;
    }
}
