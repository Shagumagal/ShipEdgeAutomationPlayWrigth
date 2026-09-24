import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import type { XenvioAuthStore } from '../infrastructure/xenvio-auth-state';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';

export interface XenvioSessionConfig {
    url: string;
    email: string;
    pass: string;
    warehouse: string;
    app: string;
}

/** Max time to decide whether the saved session landed on the dashboard or on the login form. */
const REUSE_DETECTION_TIMEOUT_MS = 15000;

/** Starts an authenticated Xenvio session and opens the Angular Shipper View. */
export class SessionService {
    /**
     * @param authStore Saved session of the current worker (see infrastructure/xenvio-auth-state.ts).
     *                  When given, the UI login is skipped if the saved session still works.
     *                  Null → always log in through the UI.
     */
    static async loginAndOpenShipperView(
        loginPage: XenvioLoginPage,
        dashboardPage: XenvioDashboardPage,
        config: XenvioSessionConfig,
        authStore: XenvioAuthStore | null = null,
    ): Promise<Page> {
        await allure.step('1. Login and Open Shipper View', async () => {
            if (authStore && await SessionService.tryReuseSavedSession(loginPage, dashboardPage, config, authStore)) {
                return;
            }
            await loginPage.navigateToLogin(config.url);
            await loginPage.login(config.email, config.pass);

            if (authStore && await dashboardPage.shipperViewLink.first().isVisible().catch(() => false)) {
                await authStore.save(loginPage.page.context());
            }
        });

        return allure.step('2. Open Shipper View', async () => dashboardPage.openShipperView());
    }

    /**
     * Injects the worker's saved cookies and checks that Xenvio opens already authenticated
     * (dashboard with the "Shipper View" link visible). Returns false — after discarding the
     * injected cookies — on any doubt, so the caller performs the regular UI login.
     */
    private static async tryReuseSavedSession(
        loginPage: XenvioLoginPage,
        dashboardPage: XenvioDashboardPage,
        config: XenvioSessionConfig,
        authStore: XenvioAuthStore,
    ): Promise<boolean> {
        const context = loginPage.page.context();
        const injected = await authStore.inject(context).catch(() => null);
        if (!injected) return false;

        try {
            await loginPage.navigateToLogin(config.url);
            await dashboardPage.shipperViewLink
                .or(loginPage.emailInput)
                .first()
                .waitFor({ state: 'visible', timeout: REUSE_DETECTION_TIMEOUT_MS });

            if (await dashboardPage.shipperViewLink.first().isVisible()) {
                console.log('🔐 Reused this worker\'s Xenvio session (UI login skipped)');
                return true;
            }
        } catch (error) {
            console.warn(`⚠️ Could not reuse saved Xenvio session: ${(error as Error).message}`);
        }

        console.log('🔐 Saved Xenvio session not valid — falling back to UI login');
        await authStore.discard(context, injected);
        return false;
    }
}
