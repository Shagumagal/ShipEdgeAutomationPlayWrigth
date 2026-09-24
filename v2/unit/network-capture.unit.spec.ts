import { test, expect, type Page } from '@playwright/test';
import {
    injectFetchInterceptor,
    pollCapturedResponse,
    readCapturedTaskError,
    resetCapturedTaskError,
    restoreFetch,
} from '../infrastructure/network-capture';

/**
 * The interceptor runs inside the browser, so these cases use a real page with mocked
 * task_executor responses. No QA environment is touched.
 *
 * The contract under test: a response counts as successful only when its status is ok AND
 * its body has no `error`. Xenvio can answer 2xx with `{ error }` (the return-label flow
 * relies on that), and such a body must never reach the parsers as if it were a label.
 */
const TASK_URL = 'https://mock.test/shipments/1/task_executor?task=label';

async function callTask(page: Page, status: number, body: unknown): Promise<void> {
    await page.route('https://mock.test/shipments/1/task_executor**', (route) => route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
    }));
    await page.evaluate((url) => fetch(url, { method: 'POST' }).catch(() => null), TASK_URL);
}

test.describe('Captura de respuestas de task_executor', { tag: ['@unit', '@carriers'] }, () => {

    test.beforeEach(async ({ page }) => {
        await page.route('https://mock.test/app', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
        await page.goto('https://mock.test/app');
        await injectFetchInterceptor(page);
    });

    test.afterEach(async ({ page }) => {
        await restoreFetch(page);
    });

    test('un 200 correcto se captura como éxito y no deja error', async ({ page }) => {
        await callTask(page, 200, { shipment: { aasmState: 'shipped' } });

        expect(await pollCapturedResponse(page, 3000, 200)).toMatchObject({ shipment: { aasmState: 'shipped' } });
        expect(await readCapturedTaskError(page)).toBeNull();
    });

    test('un 200 con body.error se trata como error y NO llega a los parsers', async ({ page }) => {
        await callTask(page, 200, { error: 'carrier response error: 503 Service Unavailable' });

        expect(await readCapturedTaskError(page, 'label')).toMatchObject({
            task: 'label',
            status: 200,
            error: 'carrier response error: 503 Service Unavailable',
        });
        expect(await pollCapturedResponse(page, 1000, 200)).toBeNull();
    });

    test('un 400 con body.error se captura como error de esa tarea', async ({ page }) => {
        await callTask(page, 400, { error: 'carrier response error: rate no disponible' });

        const captured = await readCapturedTaskError(page, 'label');
        expect(captured?.status).toBe(400);
        // El filtro por tarea ignora los errores de otras tareas.
        expect(await readCapturedTaskError(page, 'void_label')).toBeNull();
    });

    test('resetCapturedTaskError limpia el error antes de un reintento', async ({ page }) => {
        await callTask(page, 400, { error: 'carrier response error: 503 Service Unavailable' });
        expect(await readCapturedTaskError(page)).not.toBeNull();

        await resetCapturedTaskError(page);
        expect(await readCapturedTaskError(page)).toBeNull();
    });
});
