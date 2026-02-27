import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Shipedge Orders Test Suite
 * 
 * Tests for the Shipedge Orders Module.
 * Requires valid login credentials in .env
 */
test.describe('Shipedge Orders Module', () => {

    test.beforeEach(async ({ shipedgeLoginPage, shipedgeOrdersPage }) => {
        // 1. Login
        await shipedgeLoginPage.navigateToLogin();

        const email = process.env.TEST_USER_EMAIL;
        const password = process.env.TEST_USER_PASSWORD;

        if (!email || !password) {
            throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env');
        }

        await shipedgeLoginPage.login(email, password);
        await shipedgeLoginPage.waitForSuccessfulLogin();

        // 2. Handle "Remind Me Later" popup that appears right after login
        await shipedgeOrdersPage.handleRemindMeLaterPopup();
    });

    test('TC-orders-001: Verify access to Orders page', async ({
        page,
        shipedgeOrdersPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Verify Access to Orders Page",
            owner: "QA Automation Team",
            tags: ["orders", "smoke", "shipedge"],
            severity: "critical",
            epic: "Orders",
            feature: "Navigation",
            story: "Access Orders Module"
        });

        await allure.step('1. Start Create Order Flow', async () => {
            // Start the flow
            await shipedgeOrdersPage.startCreateOrderFlow();
        });

        await allure.step('2. Verify Order Saved', async () => {
            // Wait for the creation process to finish (redirect or URL change)
            await shipedgeOrdersPage.waitForOrderCreated(20000);

            console.log(`Current state verified. URL: ${page.url()}`);

            // Take a screenshot as evidence
            await AllureHelper.attachScreenShot(page);

            // Assertion: Verify we are no longer on the 'new order' blank form
            await expect(page).not.toHaveURL(/typeorder=regular/);
        });


    });

    // After hook for capturing test failure artifacts
    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
