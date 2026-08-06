import { test as helperFixture } from "./helpers-fixtures";

import { XenvioLoginPage } from "../page-objects-v2/xenvio-login-page";
import { XenvioDashboardPage } from "../page-objects-v2/xenvio-dashboard-page";
import { XenvioNewOrderPage } from "../page-objects-v2/xenvio-new-order-page";
import { XenvioShipperViewPage } from "../page-objects-v2/xenvio-shipper-view-page";

import * as allure from "allure-js-commons";

/**
 * Page Object Fixtures (v2 — PrimeNG)
 *
 * Imports only from page-objects-v2/.
 * Completely independent from the legacy fixtures.
 */
type pageObjectFixture = {
    xenvioLoginPage: XenvioLoginPage;
    xenvioDashboardPage: XenvioDashboardPage;
    xenvioNewOrderPage: XenvioNewOrderPage;
    xenvioShipperViewPage: XenvioShipperViewPage;
    allureMetadata: void;
}

export const test = helperFixture.extend<pageObjectFixture>({
    allureMetadata: [async ({ }, use) => {
        await allure.parameter("Environment", process.env.ENV_NAME || 'QA');
        await allure.parameter("URL", process.env.BASE_URL || process.env.XENVIO_URL || 'N/A');
        await use();
    }, { auto: true }],

    xenvioLoginPage: async ({ page }, use) => {
        const xenvioLoginPage = new XenvioLoginPage(page);
        use(xenvioLoginPage);
    },
    xenvioDashboardPage: async ({ page }, use) => {
        const xenvioDashboardPage = new XenvioDashboardPage(page);
        use(xenvioDashboardPage);
    },
    xenvioNewOrderPage: async ({ page }, use) => {
        const xenvioNewOrderPage = new XenvioNewOrderPage(page);
        use(xenvioNewOrderPage);
    },
    xenvioShipperViewPage: async ({ page }, use) => {
        const xenvioShipperViewPage = new XenvioShipperViewPage(page);
        use(xenvioShipperViewPage);
    },
});

export const expect = test.expect;
