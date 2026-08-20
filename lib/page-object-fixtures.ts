import { test as helperFixture } from "./helpers-fixtures";

import { ShipedgeLoginPage } from "../v1/page-objects/shipedge-login-page";
import { ShipedgeOrdersPage } from "../v1/page-objects/shipedge-orders-page";
import { XenvioLoginPage } from "../v1/page-objects/xenvio-login-page";
import { XenvioDashboardPage } from "../v1/page-objects/xenvio-dashboard-page";
import { XenvioNewOrderPage } from "../v1/page-objects/xenvio-new-order-page";
import { XenvioShipperViewPage } from "../v1/page-objects/xenvio-shipper-view-page";
import { XenvioInviteUserPage } from "../v1/page-objects/xenvio-invite-user-page";
import { YopmailRegisterPage } from "../v1/page-objects/yopmail-register-page";
import { XenvioCarrierConfigPage } from "../v1/page-objects/xenvio-carrier-config-page";
import { XenvioBestRatePage } from "../v1/page-objects/xenvio-best-rate-page";

/**
 * Page Object Fixtures
 * 
 * This file demonstrates the Fixtures pattern for dependency injection.
 * Page Objects are injected into tests via fixtures, making them easily accessible
 * and testable.
 * 
 * To add a new Page Object:
 * 1. Import the Page Object class
 * 2. Add it to the pageObjectFixture type
 * 3. Add it to the test.extend() call
 */
type pageObjectFixture = {

    shipedgeLoginPage: ShipedgeLoginPage;
    shipedgeOrdersPage: ShipedgeOrdersPage;
    xenvioLoginPage: XenvioLoginPage;
    xenvioDashboardPage: XenvioDashboardPage;
    xenvioNewOrderPage: XenvioNewOrderPage;
    xenvioShipperViewPage: XenvioShipperViewPage;
    xenvioInviteUserPage: XenvioInviteUserPage;
    yopmailRegisterPage: YopmailRegisterPage;
    xenvioCarrierConfigPage: XenvioCarrierConfigPage;
    xenvioBestRatePage: XenvioBestRatePage;
    /** Automatic fixture to attach metadata to Allure */
    allureMetadata: void;
    // Add more page objects here as needed
    // exampleProfilePage: ExampleProfilePage;
    // exampleSettingsPage: ExampleSettingsPage;
}

import * as allure from "allure-js-commons";

export const test = helperFixture.extend<pageObjectFixture>({
    // This fixture runs automatically for every test to attach Allure metadata
    allureMetadata: [async ({ }, use) => {
        await allure.parameter("Environment", process.env.ENV_NAME || 'QA');
        await allure.parameter("URL", process.env.BASE_URL || process.env.XENVIO_URL || 'N/A');
        await use();
    }, { auto: true }],

    shipedgeLoginPage: async ({ page }, use) => {
        const shipedgeLoginPage = new ShipedgeLoginPage(page);
        use(shipedgeLoginPage);
    },
    shipedgeOrdersPage: async ({ page }, use) => {
        const shipedgeOrdersPage = new ShipedgeOrdersPage(page);
        use(shipedgeOrdersPage);
    },
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
    xenvioInviteUserPage: async ({ page }, use) => {
        const xenvioInviteUserPage = new XenvioInviteUserPage(page);
        use(xenvioInviteUserPage);
    },
    yopmailRegisterPage: async ({ page }, use) => {
        const yopmailRegisterPage = new YopmailRegisterPage(page);
        use(yopmailRegisterPage);
    },
    xenvioCarrierConfigPage: async ({ page }, use) => {
        const xenvioCarrierConfigPage = new XenvioCarrierConfigPage(page);
        use(xenvioCarrierConfigPage);
    },
    xenvioBestRatePage: async ({ page }, use) => {
        const xenvioBestRatePage = new XenvioBestRatePage(page);
        use(xenvioBestRatePage);
    },
    // Add more page object fixtures here as needed
    // exampleProfilePage: async ({ page }, use) => {
    //     const exampleProfilePage = new ExampleProfilePage(page);
    //     use(exampleProfilePage);
    // },
});

export const expect = test.expect;
