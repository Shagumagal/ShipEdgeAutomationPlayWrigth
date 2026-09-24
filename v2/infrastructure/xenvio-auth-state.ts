import type { BrowserContext } from '@playwright/test';
import * as fs from 'node:fs';
import path from 'node:path';

/**
 * Reusable Xenvio login — ONE session per Playwright worker.
 *
 * The first test of each worker logs in through the UI and saves the cookies to
 * `.auth/xenvio-worker-<parallelIndex>.json`; later tests of that worker reuse them.
 * Sessions are never shared between workers on purpose: Xenvio keeps per-session
 * state, and two tests running at the same time on the same session pick up each
 * other's shipments.
 *
 * This module only stores and restores cookies (infrastructure). The login flow — trying
 * the saved session and falling back to the regular UI login when it is missing, invalid
 * or expired — lives in `SessionService`, so a problem here never fails a test by itself.
 * The fixture creates one store per worker (`createWorkerAuthStore`); `global-setup.ts`
 * clears the folder at the start of every run.
 *
 * Kill switch: XENVIO_REUSE_AUTH=false → always log in through the UI (legacy behavior).
 */
export const XENVIO_AUTH_DIR = path.resolve(__dirname, '../../.auth');

export function authStatePathForWorker(parallelIndex: number, dir: string = XENVIO_AUTH_DIR): string {
    return path.join(dir, `xenvio-worker-${parallelIndex}.json`);
}

export interface StoredCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
}

type Environment = Record<string, string | undefined>;

export function isAuthReuseEnabled(env: Environment = process.env): boolean {
    const value = env.XENVIO_REUSE_AUTH?.trim().toLowerCase();
    return !['false', '0', 'no', 'off'].includes(value ?? '');
}

function isStoredCookie(value: unknown): value is StoredCookie {
    const cookie = value as StoredCookie;
    return typeof cookie?.name === 'string'
        && typeof cookie.value === 'string'
        && typeof cookie.domain === 'string'
        && typeof cookie.path === 'string'
        && typeof cookie.expires === 'number';
}

/**
 * Keeps only the cookies worth reusing: valid, not expired and not belonging to
 * an excluded host (e.g. ShipEdge Core, which has its own login in core-import).
 */
export function selectReusableCookies(
    cookies: unknown[],
    nowSeconds: number = Date.now() / 1000,
    excludedHosts: string[] = [],
): StoredCookie[] {
    const excluded = excludedHosts.map((host) => host.toLowerCase());
    return cookies
        .filter(isStoredCookie)
        // expires === -1 means a session cookie (no expiry date).
        .filter((cookie) => cookie.expires === -1 || cookie.expires > nowSeconds)
        .filter((cookie) => !excluded.includes(cookie.domain.replace(/^\./, '').toLowerCase()));
}

/**
 * Returns the saved cookies that are still valid, or null when there is nothing
 * usable (file missing, malformed, empty or every cookie expired). Never throws.
 */
export function readStoredAuthCookies(
    filePath: string,
    nowSeconds: number = Date.now() / 1000,
): StoredCookie[] | null {
    try {
        const state = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { cookies?: unknown };
        if (!Array.isArray(state.cookies)) return null;

        const cookies = selectReusableCookies(state.cookies, nowSeconds);
        return cookies.length > 0 ? cookies : null;
    } catch {
        return null;
    }
}

/** Saves cookies for the next tests of the same worker. Never throws. */
export function writeStoredAuthCookies(filePath: string, cookies: StoredCookie[]): boolean {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ cookies }, null, 2));
        return true;
    } catch {
        return false;
    }
}

export function deleteStoredAuthState(filePath: string): void {
    fs.rmSync(filePath, { force: true });
}

/** Removes every saved session (called once per run from global-setup). Never throws. */
export function clearAllStoredAuthStates(dir: string = XENVIO_AUTH_DIR): void {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // Stale files are harmless: SessionService validates them before use.
    }
}

// ─── Store bound to one worker ───────────────────────────────────────────

function hostOf(url: string | undefined): string | null {
    try {
        return url ? new URL(url).hostname : null;
    } catch {
        return null;
    }
}

/** Saves and restores the Xenvio cookies of ONE worker. Every method is best effort. */
export class XenvioAuthStore {
    constructor(
        readonly filePath: string,
        /** Hosts whose cookies are never saved (e.g. ShipEdge Core, which has its own login). */
        private readonly excludedHosts: string[] = [],
    ) {}

    /** Adds the saved cookies to the context; returns them (to undo) or null when nothing is usable. */
    async inject(context: BrowserContext): Promise<StoredCookie[] | null> {
        const cookies = readStoredAuthCookies(this.filePath);
        if (!cookies) return null;
        await context.addCookies(cookies);
        return cookies;
    }

    /** Saves the context cookies for the next tests of this worker. */
    async save(context: BrowserContext): Promise<void> {
        try {
            const cookies = selectReusableCookies(await context.cookies(), undefined, this.excludedHosts);
            if (cookies.length > 0) writeStoredAuthCookies(this.filePath, cookies);
        } catch {
            // Not saving only means the next test logs in through the UI.
        }
    }

    /** Forgets a session that did not work: deletes the file and removes ONLY the injected cookies. */
    async discard(context: BrowserContext, injected: StoredCookie[]): Promise<void> {
        deleteStoredAuthState(this.filePath);
        for (const { name, domain, path: cookiePath } of injected) {
            await context.clearCookies({ name, domain, path: cookiePath }).catch(() => undefined);
        }
    }
}

/** Store for one worker, or null when reuse is disabled (XENVIO_REUSE_AUTH=false). */
export function createWorkerAuthStore(parallelIndex: number, env: Environment = process.env): XenvioAuthStore | null {
    if (!isAuthReuseEnabled(env)) return null;
    const coreHost = hostOf(env.BASE_URL);
    return new XenvioAuthStore(authStatePathForWorker(parallelIndex), coreHost ? [coreHost] : []);
}
