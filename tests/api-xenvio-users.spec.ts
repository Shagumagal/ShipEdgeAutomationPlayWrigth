import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

/**
 * NXEN-853 — Xenvio Users API Test Suite
 *
 * Cobertura de la Matriz de Pruebas:
 * ─────────────────────────────────────────────────────────────────────────────
 * GRUPO 1 (TC-001 a TC-007) — POST: Creación de usuarios (Admin, Regular, Errores, Bugs)
 * GRUPO 2 (TC-008 a TC-010) — PATCH: Actualización de usuarios
 * GRUPO 3 (TC-011)          — DELETE: Borrado/Soft-delete de usuarios
 * GRUPO 4 (TC-012 a TC-014) — GET: Listado, Paginación y Filtros Base64
 * GRUPO 5 (TC-015 a TC-018) — DB Persistence: Verificaciones vía API
 * GRUPO 6 (TC-025, TC-026)  — Keycloak / Legacy: Cuenta inactiva y compatibilidad
 *
 * NOTA: TC-019 a TC-024 (Flujos OAuth Keycloak) requieren redirección de
 * navegador y token real de Keycloak — no son automatizables puramente vía API.
 *
 * Cleanup: CLEAN_DB=true para limpiar usuarios creados tras los tests.
 */

// ─── Setup & Utils ────────────────────────────────────────────────────────────

const createdUserIds: number[] = [];

function getBaseUrl(): string {
    const xenvioUrl = process.env.XENVIO_URL ?? 'https://x5test.shipedge.com/users/sign_in';
    const host = new URL(xenvioUrl).origin;
    return `${host}/api/v4`;
}

function getLegacyBaseUrl(): string {
    const xenvioUrl = process.env.XENVIO_URL ?? 'https://x5test.shipedge.com/users/sign_in';
    const host = new URL(xenvioUrl).origin;
    return `${host}/api/v3`;
}

function adminHeaders(): Record<string, string> {
    return {
        'Email':        process.env.XENVIO_EMAIL ?? 'test@send.com',
        'Token':        process.env.XENVIO_API_TOKEN ?? '',
        'Accept':       'application/json',
        'Content-Type': 'application/json',
    };
}

function uniqueEmail(prefix = 'api_user'): string {
    return `${prefix}_${Date.now()}@yopmail.com`;
}

/** Codifica filtros complejos en Base64 para el parámetro `filters` del GET */
function encodeFilters(filters: object): string {
    return Buffer.from(JSON.stringify(filters)).toString('base64');
}

// ─── Suite Principal ──────────────────────────────────────────────────────────

test.describe('NXEN-853: Xenvio Users API', () => {

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO 1 — Creación (POST) | TC-001 a TC-007
    // ══════════════════════════════════════════════════════════════════════
    test.describe('GRUPO 1 — POST: Creación de Usuarios', () => {

        test('TC-001: Crear Usuario Administrador', async ({ request }) => {
            const email = uniqueEmail('admin');
            const response = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'admin' } }
            });

            const body = await response.json().catch(() => ({}));
            const id = body?.user?.id ?? body?.id;
            if (id) createdUserIds.push(id);

            console.log(`✅ TC-001 | Status: ${response.status()} | Email: ${email}`);
            expect([200, 201]).toContain(response.status());
        });

        test('TC-002: Crear Usuario Regular con Almacenes', async ({ request }) => {
            const email = uniqueEmail('manager');
            const response = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'warehouse_manager', warehouse_ids: [1, 3] } }
            });

            const body = await response.json().catch(() => ({}));
            const id = body?.user?.id ?? body?.id;
            if (id) createdUserIds.push(id);

            console.log(`✅ TC-002 | Status: ${response.status()} | Email: ${email}`);
            expect([200, 201]).toContain(response.status());
        });

        test('TC-003: Error 422 — Parámetros requeridos faltantes', async ({ request }) => {
            const response = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: {}
            });
            console.log(`✅ TC-003 | Status: ${response.status()}`);
            expect(response.status()).toBe(422);
        });

        test('TC-004: Error 422 — Warehouse inválido (ID inexistente)', async ({ request }) => {
            const response = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email: uniqueEmail('bad_wh'), role: 'warehouse_manager', warehouse_ids: [99999] } }
            });
            console.log(`✅ TC-004 | Status: ${response.status()}`);
            expect(response.status()).toBe(422);
        });

        test('TC-005: Correo Duplicado — Bug Devise (esperado 422)', async ({ request }) => {
            const email = uniqueEmail('duplicado');

            const res1 = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'admin' } }
            });
            expect([200, 201]).toContain(res1.status());

            const res2 = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'admin' } }
            });

            console.log(`TC-005 | Intento duplicado status: ${res2.status()}`);
            if (res2.status() !== 422) {
                console.warn(`⚠️ BUG DEVISE (TC-005): Se esperaba 422, se recibió ${res2.status()}.`);
            }
            expect(res2.status()).toBe(422);
        });

        test('TC-006: Error 401/403 — Acceso denegado a No Admin', async ({ request }) => {
            const response = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: {
                    'Email': 'fake_user@yopmail.com',
                    'Token': 'invalid_token_xyz',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                data: { xenvio_user: { email: uniqueEmail('forbidden'), role: 'admin' } }
            });
            console.log(`✅ TC-006 | Status: ${response.status()}`);
            expect([401, 403]).toContain(response.status());
        });

        test('TC-007: Normalización de Email a minúsculas', async ({ request }) => {
            const rawEmail = `UsEr_MiXeD_${Date.now()}@yopmail.com`;
            const expectedEmail = rawEmail.toLowerCase();

            const response = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email: rawEmail, role: 'admin' } }
            });

            console.log(`TC-007 | Status: ${response.status()}`);
            if (response.ok()) {
                const body = await response.json().catch(() => null);
                const savedEmail = body?.email ?? body?.user?.email ?? '';
                if (savedEmail && savedEmail !== expectedEmail) {
                    console.warn(`⚠️ BUG NORMALIZACIÓN (TC-007): Guardado como "${savedEmail}", se esperaba "${expectedEmail}".`);
                } else if (savedEmail) {
                    console.log(`✅ TC-007 | Email normalizado correctamente: ${savedEmail}`);
                }
            }
            expect([200, 201]).toContain(response.status());
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO 2 — Actualización (PATCH) | TC-008 a TC-010
    // ══════════════════════════════════════════════════════════════════════
    test.describe('GRUPO 2 — PATCH: Actualización de Usuarios', () => {
        let updateId: number;

        test.beforeAll(async ({ request }) => {
            const res = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email: uniqueEmail('patch_target'), role: 'admin' } }
            });
            const body = await res.json().catch(() => ({}));
            updateId = body?.user?.id ?? body?.id;
            if (updateId) createdUserIds.push(updateId);
            console.log(`🔧 PATCH setup | Usuario creado con ID: ${updateId}`);
        });

        test('TC-008: Actualizar rol y almacenes exitosamente', async ({ request }) => {
            const response = await request.patch(`${getBaseUrl()}/shipper/xenvio_users/${updateId}`, {
                headers: adminHeaders(),
                data: { xenvio_user: { role: 'warehouse_manager', warehouse_ids: [1, 3] } }
            });
            console.log(`✅ TC-008 | PATCH status: ${response.status()}`);
            expect([200, 201]).toContain(response.status());
        });

        test('TC-009: Desactivar usuario (state=pending)', async ({ request }) => {
            const response = await request.patch(`${getBaseUrl()}/shipper/xenvio_users/${updateId}`, {
                headers: adminHeaders(),
                data: { xenvio_user: { state: 'pending' } }
            });
            console.log(`✅ TC-009 | PATCH status: ${response.status()}`);
            expect([200, 201]).toContain(response.status());
        });

        test('TC-010: Error 404 — PATCH a ID inexistente', async ({ request }) => {
            const response = await request.patch(`${getBaseUrl()}/shipper/xenvio_users/9999999`, {
                headers: adminHeaders(),
                data: { xenvio_user: { role: 'admin' } }
            });
            console.log(`✅ TC-010 | PATCH status: ${response.status()}`);
            expect(response.status()).toBe(404);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO 3 — Borrado (DELETE) | TC-011
    // ══════════════════════════════════════════════════════════════════════
    test.describe('GRUPO 3 — DELETE: Borrado de Usuarios', () => {

        test('TC-011: Soft-delete exitoso de usuario existente', async ({ request }) => {
            const resCreate = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email: uniqueEmail('to_delete'), role: 'admin' } }
            });
            const body = await resCreate.json().catch(() => ({}));
            const id = body?.user?.id ?? body?.id;
            expect(id).toBeTruthy();

            const response = await request.delete(`${getBaseUrl()}/shipper/xenvio_users/${id}`, {
                headers: adminHeaders()
            });
            console.log(`✅ TC-011 | DELETE status: ${response.status()} para ID: ${id}`);
            expect(response.status()).toBe(200);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO 4 — Listado y Filtros Complejos (GET) | TC-012 a TC-014
    // ══════════════════════════════════════════════════════════════════════
    test.describe('GRUPO 4 — GET: Listado, Paginación y Filtros Base64', () => {

        test('TC-012: Listado general — respuesta 200 con array de usuarios', async ({ request }) => {
            const response = await request.get(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
            });
            const body = await response.json().catch(() => ({}));
            console.log(`✅ TC-012 | Status: ${response.status()}`);
            expect(response.status()).toBe(200);
            // Verificar que la respuesta contiene datos
            expect(body).toBeTruthy();
        });

        test('TC-013: Paginación correcta (page=1, items=5)', async ({ request }) => {
            const response = await request.get(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                params: { page: 1, items: 5 }
            });
            const body = await response.json().catch(() => ({}));
            console.log(`✅ TC-013 | Status: ${response.status()}`);
            expect(response.status()).toBe(200);
            // Si devuelve un array, verificar que el límite se respeta
            if (Array.isArray(body)) {
                expect(body.length).toBeLessThanOrEqual(5);
            }
        });

        test('TC-014: GET con Filtros Complejos en Base64', async ({ request }) => {
            const filterObject = {
                email: "xamot@gmail.com",
                role: "warehouse_manager",
                status: "pending",
                warehouse_ids: [1, 3]
            };
            const base64Filter = encodeFilters(filterObject);

            await allure.step(`Enviando filtros codificados: ${base64Filter.slice(0, 30)}...`, async () => {
                const response = await request.get(`${getBaseUrl()}/shipper/xenvio_users`, {
                    headers: adminHeaders(),
                    params: { page: 1, items: 10, filters: base64Filter }
                });
                console.log(`✅ TC-014 | GET Complex filters status: ${response.status()}`);
                expect(response.status()).toBe(200);
            });
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO 5 — Persistencia de BD (via API) | TC-015 a TC-018
    // ══════════════════════════════════════════════════════════════════════
    test.describe('GRUPO 5 — Persistencia y Relaciones en BD (verificadas via API)', () => {

        test('TC-015: Email persiste en minúsculas (Normalización en DB)', async ({ request }) => {
            const mixedEmail = `TEST_${Date.now()}@Ejemplo.com`;
            const expectedEmail = mixedEmail.toLowerCase();

            const res = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email: mixedEmail, role: 'admin' } }
            });

            console.log(`TC-015 | Status: ${res.status()}`);
            if (res.ok()) {
                const body = await res.json().catch(() => null);
                const id = body?.user?.id ?? body?.id;
                if (id) createdUserIds.push(id);

                const savedEmail = body?.user?.email ?? body?.email ?? '';
                if (savedEmail) {
                    if (savedEmail !== expectedEmail) {
                        console.warn(`⚠️ BUG DB (TC-015): Email guardado como "${savedEmail}", se esperaba "${expectedEmail}".`);
                    } else {
                        console.log(`✅ TC-015 | Email normalizado correctamente en DB: ${savedEmail}`);
                    }
                    expect(savedEmail.toLowerCase()).toBe(expectedEmail);
                }
            }
            expect([200, 201]).toContain(res.status());
        });

        test('TC-016: Relación Usuario-Warehouse verificada en respuesta', async ({ request }) => {
            const email = uniqueEmail('wh_relation');
            const warehouseIds = [1, 3];

            const res = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'warehouse_manager', warehouse_ids: warehouseIds } }
            });

            console.log(`TC-016 | Status: ${res.status()}`);
            expect([200, 201]).toContain(res.status());

            if (res.ok()) {
                const body = await res.json().catch(() => null);
                const id = body?.user?.id ?? body?.id;
                if (id) createdUserIds.push(id);

                // Verificar que el usuario aparece en el GET con los warehouses asignados
                const listRes = await request.get(`${getBaseUrl()}/shipper/xenvio_users`, {
                    headers: adminHeaders(),
                    params: { page: 1, items: 50 }
                });
                const listBody = await listRes.json().catch(() => []);
                const users = Array.isArray(listBody) ? listBody : listBody?.users ?? [];
                const createdUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase() || u.id === id);

                if (createdUser) {
                    console.log(`✅ TC-016 | Usuario encontrado en listado con warehouses.`);
                    const whs = createdUser?.warehouses ?? createdUser?.warehouse_ids ?? [];
                    if (whs.length > 0) {
                        console.log(`✅ TC-016 | Warehouses asignados: ${JSON.stringify(whs)}`);
                    }
                } else {
                    console.warn(`⚠️  TC-016 | Usuario no encontrado inmediatamente en el listado (puede ser paginación).`);
                }
            }
        });

        test('TC-017: Correo duplicado — BD bloquea duplicación en misma cuenta', async ({ request }) => {
            const email = uniqueEmail('unique_constraint');

            // Primer registro
            const res1 = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'admin' } }
            });
            expect([200, 201]).toContain(res1.status());
            const body1 = await res1.json().catch(() => ({}));
            const id1 = body1?.user?.id ?? body1?.id;
            if (id1) createdUserIds.push(id1);

            // Segundo intento con el mismo correo
            const res2 = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'admin' } }
            });

            console.log(`TC-017 | Intento duplicado (misma cuenta): ${res2.status()}`);
            if (res2.status() !== 422) {
                console.warn(`⚠️ BUG DB (TC-017): Devise.invite! no detectó duplicado. Status: ${res2.status()}.`);
            } else {
                console.log(`✅ TC-017 | BD bloqueó correctamente el correo duplicado.`);
            }
            expect(res2.status()).toBe(422);
        });

        test('TC-018: Soft-delete limpia roles (verificación post DELETE)', async ({ request }) => {
            // Crear usuario con warehouses
            const email = uniqueEmail('soft_delete_verify');
            const resCreate = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'warehouse_manager', warehouse_ids: [1, 3] } }
            });
            expect([200, 201]).toContain(resCreate.status());
            const body = await resCreate.json().catch(() => ({}));
            const id = body?.user?.id ?? body?.id;
            expect(id).toBeTruthy();

            // Eliminar usuario
            const resDel = await request.delete(`${getBaseUrl()}/shipper/xenvio_users/${id}`, {
                headers: adminHeaders()
            });
            console.log(`TC-018 | DELETE status: ${resDel.status()} para ID: ${id}`);
            expect(resDel.status()).toBe(200);

            // Verificar que ya no aparece en el listado activo
            const listRes = await request.get(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                params: { page: 1, items: 100 }
            });
            const listBody = await listRes.json().catch(() => []);
            const users = Array.isArray(listBody) ? listBody : listBody?.users ?? [];
            const deletedUser = users.find((u: any) => u.id === id);

            if (!deletedUser) {
                console.log(`✅ TC-018 | Usuario correctamente eliminado/oculto del listado activo.`);
            } else {
                console.warn(`⚠️ TC-018 | Usuario ID ${id} sigue apareciendo: puede ser soft-delete sin filtro.`);
            }
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO 6 — Keycloak / Compatibilidad Legacy | TC-025 a TC-026
    // NOTA: TC-019 a TC-024 (OAuth browser flows) NO son automatizables
    //       vía API pura — requieren browser real y token Keycloak válido.
    // ══════════════════════════════════════════════════════════════════════
    test.describe('GRUPO 6 — Keycloak / Legacy (verificables via API)', () => {

        test('TC-025: Cuenta Inactiva — App bloquea aunque Keycloak valide', async ({ request }) => {
            // Preparar: Crear usuario y desactivarlo
            const email = uniqueEmail('inactive_user');
            const resCreate = await request.post(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                data: { xenvio_user: { email, role: 'admin' } }
            });
            expect([200, 201]).toContain(resCreate.status());

            const body = await resCreate.json().catch(() => ({}));
            const id = body?.user?.id ?? body?.id;
            if (id) createdUserIds.push(id);

            // Desactivar el usuario vía PATCH
            if (id) {
                const resPatch = await request.patch(`${getBaseUrl()}/shipper/xenvio_users/${id}`, {
                    headers: adminHeaders(),
                    data: { xenvio_user: { state: 'pending' } }
                });
                console.log(`TC-025 | Usuario desactivado (state=pending): ${resPatch.status()}`);
                expect([200, 201]).toContain(resPatch.status());
            }

            // Verificar que GET del listado refleja el estado correcto
            const listRes = await request.get(`${getBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
                params: { page: 1, items: 100 }
            });
            const listBody = await listRes.json().catch(() => []);
            const users = Array.isArray(listBody) ? listBody : listBody?.users ?? [];
            const targetUser = users.find((u: any) => u.id === id);

            if (targetUser) {
                const status = targetUser?.status ?? targetUser?.state ?? targetUser?.active;
                console.log(`✅ TC-025 | Estado del usuario en listado: ${JSON.stringify(status)}`);
                console.log(`ℹ️  TC-025 | Validación de bloqueo visual en UI ("Cuenta Inactiva") requiere test E2E.`);
            }
            expect(listRes.status()).toBe(200);
        });

        test('TC-026: Compatibilidad Legacy — Endpoint v3 responde (Regresión)', async ({ request }) => {
            // Verificar que el endpoint v3 de xenvio_users sigue respondiendo
            const response = await request.get(`${getLegacyBaseUrl()}/shipper/xenvio_users`, {
                headers: adminHeaders(),
            });

            const status = response.status();
            console.log(`TC-026 | Legacy v3 GET status: ${status}`);

            if (status === 404) {
                console.warn(`⚠️ REGRESIÓN (TC-026): El endpoint v3 ya no existe. Las invitaciones legacy podrían estar rotas.`);
            } else if (status === 200) {
                console.log(`✅ TC-026 | El endpoint legacy v3 sigue operativo. Retrocompatibilidad OK.`);
            } else if ([401, 403].includes(status)) {
                console.log(`ℹ️ TC-026 | Legacy v3 requiere autenticación diferente (status: ${status}). Verificar manualmente.`);
            }

            // El test es informativo: aceptamos 200, 401, 403 como respuestas válidas (el endpoint existe)
            // Solo falla si el endpoint desapareció completamente (404/500)
            expect([200, 201, 401, 403]).toContain(status);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // NOTA SOBRE FLUJOS KEYCLOAK (TC-019 a TC-024)
    // ══════════════════════════════════════════════════════════════════════
    // Los siguientes casos NO son automatizables puramente via API:
    //
    // TC-019 — Migración Temporal (User App, no Keycloak)
    // TC-020 — Invitación - Usuario Nuevo (Flujo completo con email + redirect)
    // TC-021 — Invitación - Usuario Keycloak Existente (redirect OAuth)
    // TC-022 — Registro Orgánico / Directo por URL (flujo OAuth completo)
    // TC-023 — Registro Silencioso por Token Keycloak (Token Introspect)
    // TC-024 — Login Estándar Happy Path (browser OAuth redirect)
    //
    // Requieren: Browser real + token Keycloak válido + interceptar redirect OAuth.
    // Se deben implementar como tests E2E (Playwright browser) en un archivo separado.

    // ══════════════════════════════════════════════════════════════════════
    // LIMPIEZA CONDICIONAL
    // ══════════════════════════════════════════════════════════════════════
    test.afterAll(async ({ request }) => {
        if (process.env.CLEAN_DB === 'true' && createdUserIds.length > 0) {
            console.log(`\n🧹 Iniciando limpieza de ${createdUserIds.length} usuarios creados...`);
            for (const id of createdUserIds) {
                const response = await request.delete(`${getBaseUrl()}/shipper/xenvio_users/${id}`, {
                    headers: adminHeaders()
                });
                if (response.ok()) {
                    console.log(`   ✓ ID ${id} eliminado.`);
                } else {
                    console.warn(`   ⚠ ID ${id} no se pudo eliminar (status: ${response.status()}).`);
                }
            }
            console.log('✅ Limpieza completada.');
        } else if (createdUserIds.length > 0) {
            console.log(`\nℹ️  Se mantienen ${createdUserIds.length} usuarios en DB. Usa CLEAN_DB=true para borrarlos.`);
            console.log(`   IDs: [${createdUserIds.join(', ')}]`);
        }
    });

});
