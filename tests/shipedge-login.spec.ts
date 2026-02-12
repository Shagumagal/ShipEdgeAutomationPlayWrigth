import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Shipedge Login Test Suite
 * 
 * Tests for the Shipedge login page: https://qa8.shipedge.com/login.php
 * 
 * Prerequisites:
 * - Configure .env with valid TEST_USER_EMAIL and TEST_USER_PASSWORD
 * - Ensure BASE_URL is set to https://qa8.shipedge.com
 */
test.describe('Shipedge Login', () => {

    test.beforeEach(async ({ shipedgeLoginPage }) => {
        // Navigate to the login page before each test
        await shipedgeLoginPage.navigateToLogin();
        await shipedgeLoginPage.waitForLoginPageLoad();
    });

    test('TC-001: Login page loads correctly with all elements', async ({
        page,
        shipedgeLoginPage,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Login Page Loads Correctly",
            owner: "QA Automation Team",
            tags: ["login", "smoke", "shipedge"],
            severity: "critical",
            epic: "Authentication",
            feature: "Login Page",
            story: "Page Load",
            parentSuite: "Shipedge Login Suite",
            suite: "Login Tests",
            subSuite: "Smoke Tests"
        });

        await allure.step('1. Verify login page URL', async () => {
            const currentURL = page.url();
            expect(currentURL).toContain('login.php');
            console.log(`Current URL: ${currentURL}`);
        });

        await allure.step('2. Verify email input is visible', async () => {
            const emailVisible = await shipedgeLoginPage.isEmailInputVisible();
            expect(emailVisible).toBe(true);
        });

        await allure.step('3. Verify password input is visible', async () => {
            const passwordVisible = await shipedgeLoginPage.isPasswordInputVisible();
            expect(passwordVisible).toBe(true);
        });

        await allure.step('4. Verify login button is visible', async () => {
            const loginButtonVisible = await shipedgeLoginPage.isLoginButtonVisible();
            expect(loginButtonVisible).toBe(true);
        });

        await allure.step('5. Verify Forgot Password link is visible', async () => {
            const forgotLinkVisible = await shipedgeLoginPage.isForgotPasswordLinkVisible();
            expect(forgotLinkVisible).toBe(true);
        });

        await allure.step('6. Capture login page screenshot', async () => {
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-002: Successful login with valid credentials', async ({
        page,
        shipedgeLoginPage,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Successful Login with Valid Credentials",
            owner: "QA Automation Team",
            tags: ["login", "smoke", "critical", "shipedge"],
            severity: "critical",
            epic: "Authentication",
            feature: "Login",
            story: "Valid Login",
            parentSuite: "Shipedge Login Suite",
            suite: "Login Tests",
            subSuite: "Smoke Tests"
        });

        const email = process.env.TEST_USER_EMAIL || 'test@example.com';
        const password = process.env.TEST_USER_PASSWORD || 'password123';

        await allure.step('1. Enter valid email', async () => {
            await shipedgeLoginPage.enterEmail(email);
            console.log(`Entered email: ${email}`);
        });

        await allure.step('2. Enter valid password', async () => {
            await shipedgeLoginPage.enterPassword(password);
            console.log('Password entered successfully');
        });

        await allure.step('3. Click Login button', async () => {
            await shipedgeLoginPage.clickLogin();
        });

        await allure.step('4. Verify successful login - redirected away from login page', async () => {
            await shipedgeLoginPage.waitForSuccessfulLogin();
            const isStillOnLogin = await shipedgeLoginPage.isStillOnLoginPage();
            expect(isStillOnLogin).toBe(false);
            console.log(`Redirected to: ${page.url()}`);
        });

        await allure.step('5. Capture post-login screenshot', async () => {
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-003: Failed login with invalid credentials', async ({
        page,
        shipedgeLoginPage,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Failed Login with Invalid Credentials",
            owner: "QA Automation Team",
            tags: ["login", "negative", "regression", "shipedge"],
            severity: "normal",
            epic: "Authentication",
            feature: "Login",
            story: "Invalid Login",
            parentSuite: "Shipedge Login Suite",
            suite: "Login Tests",
            subSuite: "Regression Tests"
        });

        await allure.step('1. Enter invalid email', async () => {
            await shipedgeLoginPage.enterEmail('invalid_user@test.com');
        });

        await allure.step('2. Enter invalid password', async () => {
            await shipedgeLoginPage.enterPassword('wrong_password_123');
        });

        await allure.step('3. Click Login button', async () => {
            await shipedgeLoginPage.clickLogin();
        });

        await allure.step('4. Verify user stays on login page or sees error', async () => {
            // Wait a moment for any error messages or redirects
            await page.waitForTimeout(3000);

            const isStillOnLogin = await shipedgeLoginPage.isStillOnLoginPage();
            const hasError = await shipedgeLoginPage.isErrorMessageVisible();

            // At least one of these should be true for a failed login
            expect(isStillOnLogin || hasError).toBe(true);

            if (hasError) {
                const errorText = await shipedgeLoginPage.getErrorMessage();
                console.log(`Error message displayed: ${errorText}`);
            } else {
                console.log('User remained on login page (no explicit error message found)');
            }
        });

        await allure.step('5. Capture error state screenshot', async () => {
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-004: Login with empty fields', async ({
        page,
        shipedgeLoginPage,
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Login with Empty Fields",
            owner: "QA Automation Team",
            tags: ["login", "negative", "validation", "shipedge"],
            severity: "normal",
            epic: "Authentication",
            feature: "Login",
            story: "Field Validation",
            parentSuite: "Shipedge Login Suite",
            suite: "Login Tests",
            subSuite: "Validation Tests"
        });

        await allure.step('1. Click Login button without entering credentials', async () => {
            await shipedgeLoginPage.clickLogin();
        });

        await allure.step('2. Verify user stays on login page', async () => {
            await page.waitForTimeout(2000);
            const isStillOnLogin = await shipedgeLoginPage.isStillOnLoginPage();
            expect(isStillOnLogin).toBe(true);
            console.log('User correctly remained on login page with empty fields');
        });

        await allure.step('3. Capture validation state screenshot', async () => {
            await AllureHelper.attachScreenShot(page);
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
