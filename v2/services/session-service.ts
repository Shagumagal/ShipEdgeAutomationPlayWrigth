import { Page } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';

export interface XenvioSessionConfig {
    url: string;
    email: string;
    pass: string;
    warehouse: string;
    app: string;
}

/** Starts an authenticated Xenvio session and opens the Angular Shipper View. */
export class SessionService {
    static async loginAndOpenShipperView(
        loginPage: XenvioLoginPage,
        dashboardPage: XenvioDashboardPage,
        config: XenvioSessionConfig,
    ): Promise<Page> {
        await allure.step('1. Login and Open Shipper View', async () => {
            await loginPage.navigateToLogin(config.url);
            await loginPage.login(config.email, config.pass);
        });

        return allure.step('2. Open Shipper View', async () => dashboardPage.openShipperView());
    }
}
