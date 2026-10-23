export interface XenvioConfig {
    readonly url: string;
    readonly email: string;
    readonly pass: string;
    readonly app: string;
    readonly warehouse: string;
    readonly environment: string;
}

type Environment = Record<string, string | undefined>;

const REQUIRED_VARIABLES = [
    'XENVIO_URL',
    'XENVIO_EMAIL',
    'XENVIO_PASSWORD',
    'APP_XENVIO',
    'WAREHOUSE_XENVIO',
] as const;

/** Reads and validates the shared Xenvio configuration once per test. */
export function loadXenvioConfig(env: Environment = process.env): XenvioConfig {
    const missing = REQUIRED_VARIABLES.filter((name) => !env[name]?.trim());

    if (missing.length > 0) {
        throw new Error(
            `Missing required Xenvio environment variables: ${missing.join(', ')}. ` +
            'Add them to .env before running the v2 suite.',
        );
    }

    return Object.freeze({
        url: env.XENVIO_URL!.trim(),
        email: env.XENVIO_EMAIL!.trim(),
        pass: env.XENVIO_PASSWORD!,
        app: env.APP_XENVIO!.trim(),
        warehouse: env.WAREHOUSE_XENVIO!.trim(),
        environment: env.ENV_NAME?.trim() || 'QA',
    });
}

export interface XenvioApiConfig {
    readonly url: string;
    readonly email: string;
    readonly token: string;
    /**
     * Default ship code (API_ORDER_SHIP_CODE) of the orders the API ships, e.g. for the void test;
     * must exist once among the warehouse's carriers. Null when not set: only the tests that ship
     * with the default need it (ApiOrderService.createShippedOrder), not those that bring their own.
     */
    readonly shipCode: string | null;
}

const API_VARIABLES = ['XENVIO_URL', 'XENVIO_EMAIL', 'XENVIO_API_TOKEN'] as const;

/** Xenvio API v3 credentials, read only by the tests that create orders through the API. */
export function loadXenvioApiConfig(env: Environment = process.env): XenvioApiConfig {
    const missing = API_VARIABLES.filter((name) => !env[name]?.trim());

    if (missing.length > 0) {
        throw new Error(
            `Missing Xenvio API variables: ${missing.join(', ')}. ` +
            'Add them to .env to create orders through API v3.',
        );
    }

    return Object.freeze({
        url: env.XENVIO_URL!.trim(),
        email: env.XENVIO_EMAIL!.trim(),
        token: env.XENVIO_API_TOKEN!.trim(),
        shipCode: env.API_ORDER_SHIP_CODE?.trim() || null,
    });
}

/**
 * ORDERS_TO_CREATE as a whole number of 1 or more (`fallback` when unset). Anything else is a
 * configuration error: with 0, a negative number or text the loops would run no order and pass.
 */
export function loadOrdersToCreate(fallback: number, env: Environment = process.env): number {
    const raw = env.ORDERS_TO_CREATE?.trim();
    const value = raw ? Number(raw) : fallback;
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`ORDERS_TO_CREATE must be a whole number of 1 or more; received "${raw}".`);
    }
    return value;
}

export interface InternationalLabelConfig {
    /** Warehouse of the international orders (e.g. qa22). */
    readonly warehouse: string;
    /** International ship code: once among the warehouse's carriers, on a TEST account (e.g. EUSPMI). */
    readonly shipCode: string;
    /** Carrier group of the Tax ID Type list for that ship code (e.g. USPS). */
    readonly taxIdCarrier: string;
}

/**
 * Carrier setup of the International Settings test, or null when it is not configured (the test is
 * skipped: the ship code has to be checked per environment, see docs/21-international-settings.md).
 */
export function loadInternationalLabelConfig(env: Environment = process.env): InternationalLabelConfig | null {
    const warehouse = env.INTL_LABEL_WAREHOUSE?.trim();
    const shipCode = env.INTL_LABEL_SHIP_CODE?.trim();
    if (!warehouse && !shipCode) return null;
    if (!warehouse || !shipCode) {
        throw new Error('Set both INTL_LABEL_WAREHOUSE and INTL_LABEL_SHIP_CODE in .env (or neither, to skip the International Settings test).');
    }

    return Object.freeze({
        warehouse,
        shipCode,
        taxIdCarrier: env.INTL_LABEL_TAX_ID_CARRIER?.trim() || 'USPS',
    });
}
