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
