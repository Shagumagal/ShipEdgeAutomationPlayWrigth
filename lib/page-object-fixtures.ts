import { test as helperFixture } from "./helpers-fixtures";

import { ShipedgeLoginPage } from "../page-objects/shipedge-login-page";
import { ShipedgeOrdersPage } from "../page-objects/shipedge-orders-page";
import { XenvioLoginPage } from "../page-objects/xenvio-login-page";
import { XenvioDashboardPage } from "../page-objects/xenvio-dashboard-page";
import { XenvioNewOrderPage } from "../page-objects/xenvio-new-order-page";
import { XenvioLegacySettingsPage } from "../page-objects/xenvio-legacy-settings-page";
import { XenvioShipperViewPage } from "../page-objects/xenvio-shipper-view-page";
import { XenvioInviteUserPage } from "../page-objects/xenvio-invite-user-page";
import { YopmailRegisterPage } from "../page-objects/yopmail-register-page";

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
    xenvioLegacySettingsPage: XenvioLegacySettingsPage;
    xenvioShipperViewPage: XenvioShipperViewPage;
    xenvioInviteUserPage: XenvioInviteUserPage;
    yopmailRegisterPage: YopmailRegisterPage;
    // Add more page objects here as needed
    // exampleProfilePage: ExampleProfilePage;
    // exampleSettingsPage: ExampleSettingsPage;
}

export const test = helperFixture.extend<pageObjectFixture>({

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
    xenvioLegacySettingsPage: async ({ page }, use) => {
        const xenvioLegacySettingsPage = new XenvioLegacySettingsPage(page);
        use(xenvioLegacySettingsPage);
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
    // Add more page object fixtures here as needed
    // exampleProfilePage: async ({ page }, use) => {
    //     const exampleProfilePage = new ExampleProfilePage(page);
    //     use(exampleProfilePage);
    // },
});

export const expect = test.expect;
