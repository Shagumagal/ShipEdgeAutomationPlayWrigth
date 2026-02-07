import { test as helperFixture } from "./helpers-fixtures";
import { ExampleLoginPage } from "../page-objects/example-login-page";
import { ExampleDashboardPage } from "../page-objects/example-dashboard-page";

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
    exampleLoginPage: ExampleLoginPage;
    exampleDashboardPage: ExampleDashboardPage;
    // Add more page objects here as needed
    // exampleProfilePage: ExampleProfilePage;
    // exampleSettingsPage: ExampleSettingsPage;
}

export const test = helperFixture.extend<pageObjectFixture>({
    exampleLoginPage: async ({ page }, use) => {
        const exampleLoginPage = new ExampleLoginPage(page);
        use(exampleLoginPage);
    },
    exampleDashboardPage: async ({ page }, use) => {
        const exampleDashboardPage = new ExampleDashboardPage(page);
        use(exampleDashboardPage);
    },
    // Add more page object fixtures here as needed
    // exampleProfilePage: async ({ page }, use) => {
    //     const exampleProfilePage = new ExampleProfilePage(page);
    //     use(exampleProfilePage);
    // },
});

export const expect = test.expect;
