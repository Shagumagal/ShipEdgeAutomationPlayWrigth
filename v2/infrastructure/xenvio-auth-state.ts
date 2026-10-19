import type { BrowserContext } from '@playwright/test';
import * as fs from 'node:fs';
import path from 'node:path';

/**
 * Reusable Xenvio login — ONE session per Playwright worker.
 *
 * The first test of each worker logs in through the UI and saves the cookies to
 * `.auth/run-<id>/xenvio-worker-<parallelIndex>.json`; later tests of that worker reuse them.
 * Each run has its own folder, so two runs in the same checkout (e.g. the purge while the suite
 * runs) never share a session or clear each other's files.
 * Sessions are never shared between workers on purpose: Xenvio keeps per-session
 * state, and two tests running at the same time on the same session pick up each
 * other's shipments.
 *
 * This module only stores and restores cookies (infrastructure). The login flow — trying
 * the saved session and falling back to the regular UI login when it is missing, invalid
 * or expired — lives in `SessionService`, so a problem here never fails a test by itself.
 * The fixture creates one store per worker (`createWorkerAuthStore`); `global-setup.ts` starts the
 * run folder (`startAuthRun`) and `global-teardown.ts` deletes it (`endAuthRun`).
 *
 * Kill switch: XENVIO_REUSE_AUTH=false → always log in through the UI (legacy behavior).
 */
export const XENVIO_AUTH_DIR = path.resolve(__dirname, '../../.auth');

/** How global-setup hands this run's folder to the workers (they inherit its process.env). */
export const AUTH_RUN_DIR_ENV = 'XENVIO_AUTH_RUN_DIR';

/** A run folder this old belongs to a run that crashed before its teardown. */
const STALE_RUN_MS = 24 * 60 * 60 * 1000;

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

/**
 * Starts this run's session folder and publishes it to the workers (global-setup). Only folders
 * of runs that crashed a day ago are pruned: another run may be using the rest. Never throws.
 */
export function startAuthRun(env: Environment = process.env, dir: string = XENVIO_AUTH_DIR, now: number = Date.now()): string {
    pruneStaleAuthRuns(dir, now);
    const runDir = path.join(dir, `run-${now}-${process.pid}`);
    env[AUTH_RUN_DIR_ENV] = runDir;
    return runDir;
}

/** Deletes this run's saved sessions once every worker has finished (global-teardown). Never throws. */
export function endAuthRun(env: Environment = process.env): void {
    const runDir = env[AUTH_RUN_DIR_ENV];
    if (runDir) removeQuietly(runDir);
}

/** Removes run folders older than `maxAgeMs` and loose session files from before per-run folders. */
export function pruneStaleAuthRuns(dir: string = XENVIO_AUTH_DIR, now: number = Date.now(), maxAgeMs: number = STALE_RUN_MS): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return; // no .auth yet
    }
    for (const entry of entries) {
        const target = path.join(dir, entry.name);
        const legacyFile = entry.isFile() && /^xenvio-worker-\d+\.json$/.test(entry.name);
        const staleRun = entry.isDirectory() && entry.name.startsWith('run-') && isOlderThan(target, now, maxAgeMs);
        if (legacyFile || staleRun) removeQuietly(target);
    }
}

function isOlderThan(target: string, now: number, maxAgeMs: number): boolean {
    try {
        return now - fs.statSync(target).mtimeMs > maxAgeMs;
    } catch {
        return false;
    }
}

function removeQuietly(target: string): void {
    try {
        fs.rmSync(target, { recursive: true, force: true });
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

/** Store for one worker of this run, or null when reuse is disabled (XENVIO_REUSE_AUTH=false). */
export function createWorkerAuthStore(parallelIndex: number, env: Environment = process.env): XenvioAuthStore | null {
    if (!isAuthReuseEnabled(env)) return null;
    const coreHost = hostOf(env.BASE_URL);
    const runDir = env[AUTH_RUN_DIR_ENV] || XENVIO_AUTH_DIR;
    return new XenvioAuthStore(authStatePathForWorker(parallelIndex, runDir), coreHost ? [coreHost] : []);
}
