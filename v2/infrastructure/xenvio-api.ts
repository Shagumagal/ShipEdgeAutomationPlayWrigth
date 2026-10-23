import type { APIRequestContext } from '@playwright/test';
import type { OutgoingRecord } from '../domain/carriers/carrier-errors';
import type { XenvioUserRecord } from '../domain/users/xenvio-user';

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
 * Used to clean up what tests create (see runtime/test-data-registry.ts) and to read back the
 * state the UI does not show in full (e.g. the status of an invited user).
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

    /**
     * Users of the admin's account whose email contains `emailFilter` (the admin itself is never
     * listed). Admin only: the backend answers 403 to other roles.
     */
    async listXenvioUsers(emailFilter = ''): Promise<XenvioUserRecord[]> {
        // The Angular app sends the filters as base64url JSON (shared/utils/base64URL.util.ts)
        const filters = emailFilter ? `&filters=${Buffer.from(JSON.stringify({ email: emailFilter })).toString('base64url')}` : '';
        const users: XenvioUserRecord[] = [];
        for (let page = 1; ; page++) {
            const { users: rows, pagination_results } = await this.send<XenvioUsersPage>(
                'GET',
                `/shipper/xenvio_users?items=50&page=${page}${filters}`,
            );
            users.push(...rows);
            if (page >= (pagination_results?.total_pages ?? 1)) return users;
        }
    }

    /** The user with exactly this email, or null. */
    async findXenvioUser(email: string): Promise<XenvioUserRecord | null> {
        const wanted = email.toLowerCase();
        const users = await this.listXenvioUsers(email);
        return users.find((user) => user.email.toLowerCase() === wanted) ?? null;
    }

    /**
     * Carrier calls of a shipment (History → View Requests), newest first. Bodies come back
     * parsed when they are JSON; headers may carry carrier credentials, so redact before attaching.
     */
    listShipmentRequests(shipmentId: number): Promise<OutgoingRecord[]> {
        return this.send<OutgoingRecord[]>('GET', `/shipments/${shipmentId}/view_requests2`);
    }

    /** Hard delete of the Xenvio user (its account in the SSO is not touched). */
    async deleteXenvioUser(id: number): Promise<void> {
        await this.send('DELETE', `/shipper/xenvio_users/${id}`);
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

interface XenvioUsersPage {
    users: XenvioUserRecord[];
    pagination_results?: { total_pages: number };
}
