import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import {
    authStatePathForWorker,
    clearAllStoredAuthStates,
    createWorkerAuthStore,
    deleteStoredAuthState,
    isAuthReuseEnabled,
    readStoredAuthCookies,
    selectReusableCookies,
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

test.describe('Sesión guardada de Xenvio', { tag: ['@unit', '@auth'] }, () => {

    test('la reutilización está activa por defecto y se apaga con XENVIO_REUSE_AUTH', () => {
        expect(isAuthReuseEnabled({})).toBe(true);
        expect(isAuthReuseEnabled({ XENVIO_REUSE_AUTH: 'true' })).toBe(true);
        for (const off of ['false', 'FALSE', '0', 'no', 'off', ' false ']) {
            expect(isAuthReuseEnabled({ XENVIO_REUSE_AUTH: off })).toBe(false);
        }
    });

    test('sin archivo o con archivo corrupto devuelve null (el test hará login por UI)', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        expect(readStoredAuthCookies(`${dir}/no-existe.json`, NOW)).toBeNull();
        expect(readStoredAuthCookies(writeState(`${dir}/corrupto.json`, '{no es json'), NOW)).toBeNull();
        expect(readStoredAuthCookies(writeState(`${dir}/sin-cookies.json`, { origins: [] }), NOW)).toBeNull();
        expect(readStoredAuthCookies(writeState(`${dir}/vacio.json`, { cookies: [] }), NOW)).toBeNull();
    });

    test('descarta cookies vencidas o malformadas y conserva las de sesión', () => {
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

    test('si todas las cookies vencieron devuelve null', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        const file = writeState(`${dir}/state.json`, { cookies: [cookie({ expires: NOW - 10 })] });
        expect(readStoredAuthCookies(file, NOW)).toBeNull();
    });

    test('borrar el estado no falla aunque el archivo no exista', () => {
        const dir = test.info().outputPath();
        fs.mkdirSync(dir, { recursive: true });
        const file = writeState(`${dir}/state.json`, { cookies: [cookie()] });
        deleteStoredAuthState(file);
        expect(fs.existsSync(file)).toBe(false);
        expect(() => deleteStoredAuthState(file)).not.toThrow();
    });

    test('cada worker tiene su propio archivo de sesión (nunca se comparte)', () => {
        expect(authStatePathForWorker(0, '/tmp/auth')).toBe('/tmp/auth/xenvio-worker-0.json');
        expect(authStatePathForWorker(1, '/tmp/auth')).not.toBe(authStatePathForWorker(0, '/tmp/auth'));
    });

    test('no guarda cookies de ShipEdge Core (host excluido), con o sin punto inicial', () => {
        const kept = selectReusableCookies([
            cookie({ name: 'xenvio' }),
            cookie({ name: 'core', domain: 'qa20.shipedge.com' }),
            cookie({ name: 'core-dot', domain: '.QA20.shipedge.com' }),
        ], NOW, ['qa20.shipedge.com']);
        expect(kept.map((c) => c.name)).toEqual(['xenvio']);
    });

    test('lo que se guarda se puede volver a leer, y limpiar todo borra la carpeta', () => {
        const dir = test.info().outputPath('auth');
        const file = authStatePathForWorker(3, dir);
        expect(writeStoredAuthCookies(file, [cookie()])).toBe(true);
        expect(readStoredAuthCookies(file, NOW)?.map((c) => c.name)).toEqual(['_xenvio_session']);

        clearAllStoredAuthStates(dir);
        expect(fs.existsSync(dir)).toBe(false);
        expect(() => clearAllStoredAuthStates(dir)).not.toThrow();
    });

    test('el store por worker respeta el kill switch y nunca guarda cookies de ShipEdge Core', () => {
        expect(createWorkerAuthStore(0, { XENVIO_REUSE_AUTH: 'false' })).toBeNull();

        const store = createWorkerAuthStore(2, { BASE_URL: 'https://qa20.shipedge.com/login.php' });
        expect(store?.filePath).toMatch(/xenvio-worker-2\.json$/);
        expect(selectReusableCookies([cookie({ domain: 'qa20.shipedge.com' })], NOW, ['qa20.shipedge.com'])).toEqual([]);
    });
});
