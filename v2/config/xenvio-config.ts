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
    /** Ship code for orders created through the API; must exist once among the warehouse's carriers. */
    readonly shipCode: string;
}

const API_VARIABLES = ['XENVIO_URL', 'XENVIO_EMAIL', 'XENVIO_API_TOKEN', 'API_ORDER_SHIP_CODE'] as const;

/** Xenvio API v3 settings, read only by the tests that create orders through the API. */
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
        shipCode: env.API_ORDER_SHIP_CODE!.trim(),
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
