import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import path from 'node:path';
import {
    AUTH_RUN_DIR_ENV,
    authStatePathForWorker,
    createWorkerAuthStore,
    deleteStoredAuthState,
    endAuthRun,
    isAuthReuseEnabled,
    pruneStaleAuthRuns,
    readStoredAuthCookies,
    selectReusableCookies,
    startAuthRun,
    writeStoredAuthCookies,
    type StoredCookie,
} from '../infrastructure/xenvio-auth-state';

const NOW = 1_800_000_000;

function cookie(overrides: Partial<StoredCookie> = {}): StoredCookie {
    return {
        name: '_xenvio_session',
        value: 'abc',
        domain: 'x5demo1.shipedge.com',
        path: '/',
        expires: NOW + 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        ...overrides,
    };
}

function writeState(filePath: string, content: unknown): string {
    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
    return filePath;
}

test.describe('Saved Xenvio session', { tag: ['@unit', '@auth'] }, () => {

    test('reuse is on by default and can be turned off with XENVIO_REUSE_AUTH', () => {
        expect(isAuthReuseEnabled({})).toBe(true);
        expect(isAuthReuseEnabled({ XENVIO_REUSE_AUTH: 'true' })).toBe(true);
        for (const off of ['false', 'FALSE', '0', 'no', 'off', ' false ']) {
            expect(isAuthReuseEnabled({ XENVIO_REUSE_AUTH: off })).toBe(false);
        }
    });

    test('returns null when the file is missing or corrupt (the test logs in through the UI)', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        expect(readStoredAuthCookies(`${dir}/no-existe.json`, NOW)).toBeNull();
        expect(readStoredAuthCookies(writeState(`${dir}/corrupto.json`, '{no es json'), NOW)).toBeNull();
        expect(readStoredAuthCookies(writeState(`${dir}/sin-cookies.json`, { origins: [] }), NOW)).toBeNull();
        expect(readStoredAuthCookies(writeState(`${dir}/vacio.json`, { cookies: [] }), NOW)).toBeNull();
    });

    test('drops expired or malformed cookies and keeps session ones', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        const file = writeState(`${dir}/state.json`, {
            cookies: [
                cookie({ name: 'vigente' }),
                cookie({ name: 'de-sesion', expires: -1 }),
                cookie({ name: 'vencida', expires: NOW - 1 }),
                { name: 'malformada' },
            ],
        });

        expect(readStoredAuthCookies(file, NOW)?.map((c) => c.name)).toEqual(['vigente', 'de-sesion']);
    });

    test('returns null when every cookie has expired', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        const file = writeState(`${dir}/state.json`, { cookies: [cookie({ expires: NOW - 10 })] });
        expect(readStoredAuthCookies(file, NOW)).toBeNull();
    });

    test('deleting the state does not fail when the file is missing', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        const file = writeState(`${dir}/state.json`, { cookies: [cookie()] });
        deleteStoredAuthState(file);
        expect(fs.existsSync(file)).toBe(false);
        expect(() => deleteStoredAuthState(file)).not.toThrow();
    });

    test('each worker has its own session file (never shared)', () => {
        expect(authStatePathForWorker(0, '/tmp/auth')).toBe('/tmp/auth/xenvio-worker-0.json');
        expect(authStatePathForWorker(1, '/tmp/auth')).not.toBe(authStatePathForWorker(0, '/tmp/auth'));
    });

    test('never saves ShipEdge Core cookies (excluded host), with or without a leading dot', () => {
        const kept = selectReusableCookies([
            cookie({ name: 'xenvio' }),
            cookie({ name: 'core', domain: 'qa20.shipedge.com' }),
            cookie({ name: 'core-dot', domain: '.QA20.shipedge.com' }),
        ], NOW, ['qa20.shipedge.com']);
        expect(kept.map((c) => c.name)).toEqual(['xenvio']);
    });

    test('what is saved can be read back, and the end of the run removes its folder', () => {
        const runDir = test.info().outputPath('auth', 'run-1');
        const file = authStatePathForWorker(3, runDir);
        expect(writeStoredAuthCookies(file, [cookie()])).toBe(true);
        expect(readStoredAuthCookies(file, NOW)?.map((c) => c.name)).toEqual(['_xenvio_session']);

        endAuthRun({ [AUTH_RUN_DIR_ENV]: runDir });
        expect(fs.existsSync(runDir)).toBe(false);
        expect(() => endAuthRun({ [AUTH_RUN_DIR_ENV]: runDir })).not.toThrow();
        expect(() => endAuthRun({})).not.toThrow();
    });

    test('the per-worker store honors the kill switch and never saves ShipEdge Core cookies', () => {
        expect(createWorkerAuthStore(0, { XENVIO_REUSE_AUTH: 'false' })).toBeNull();

        const store = createWorkerAuthStore(2, { BASE_URL: 'https://qa20.shipedge.com/login.php' });
        expect(store?.filePath).toMatch(/xenvio-worker-2\.json$/);
        expect(selectReusableCookies([cookie({ domain: 'qa20.shipedge.com' })], NOW, ['qa20.shipedge.com'])).toEqual([]);
    });

    test('each run gets its own folder and its workers store sessions there', () => {
        const dir = test.info().outputPath('auth');
        const env: Record<string, string | undefined> = {};
        const runDir = startAuthRun(env, dir, 1_000);

        expect(path.dirname(runDir)).toBe(dir);
        expect(path.basename(runDir)).toMatch(/^run-1000-\d+$/);
        expect(createWorkerAuthStore(2, env)?.filePath).toBe(path.join(runDir, 'xenvio-worker-2.json'));
    });

    test('starting a run never touches a run still going; it prunes crashed runs and loose old files', () => {
        const dir = test.info().outputPath('auth');
        const now = Date.now();
        const active = path.join(dir, 'run-active');
        const crashed = path.join(dir, 'run-crashed');
        const legacy = path.join(dir, 'xenvio-worker-0.json');
        writeStoredAuthCookies(path.join(active, 'xenvio-worker-0.json'), [cookie()]);
        writeStoredAuthCookies(path.join(crashed, 'xenvio-worker-0.json'), [cookie()]);
        writeStoredAuthCookies(legacy, [cookie()]);
        const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
        fs.utimesSync(crashed, twoDaysAgo, twoDaysAgo);

        pruneStaleAuthRuns(dir, now);

        expect(fs.existsSync(active)).toBe(true);
        expect(fs.existsSync(crashed)).toBe(false);
        expect(fs.existsSync(legacy)).toBe(false);
        expect(() => pruneStaleAuthRuns(path.join(dir, 'missing'), now)).not.toThrow();
    });
});
