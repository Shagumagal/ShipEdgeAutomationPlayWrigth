import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Example Login Test Suite
 * 
 * This test demonstrates:
 * - Allure reporting with metadata (epic, feature, story, severity, tags)
 * - Page Object Model usage via fixtures
 * - Allure steps for test organization
 * - Screenshot attachment
 * - Error handling with test failure artifact capture
 * - beforeEach/afterEach hooks
 * - Environment variable usage
 */
test.describe('Login Functionality', () => {
    
    test.beforeEach(async ({ exampleLoginPage, waitForPageLoad }) => {
        // Navigate to login page before each test
        await exampleLoginPage.navigateToLogin();
        await waitForPageLoad();
    });

    test('TC-001: Successful Login with Valid Credentials', async ({ 
        page, 
        exampleLoginPage
    }) => {
        // Apply Allure metadata for test organization and reporting
        await AllureHelper.applyTestMetadata({
            displayName: "Successful Login with Valid Credentials",
            owner: "QA Automation Team",
            tags: ["login", "authentication", "smoke", "critical"],
            severity: "critical",
            epic: "Authentication",
            feature: "Login",
            story: "User Login",
            parentSuite: "Authentication Suite",
            suite: "Login Tests",
            subSuite: "Positive Tests"
        });

        await allure.step('1. Verify login page elements are visible', async () => {
            expect(await exampleLoginPage.isEmailInputVisible()).toBe(true);
            expect(await exampleLoginPage.isPasswordInputVisible()).toBe(true);
        });

        await allure.step('2. Enter valid credentials', async () => {
            // Use environment variables for credentials (set in .env file)
            const email = process.env.TEST_USER_EMAIL || 'test@example.com';
            const password = process.env.TEST_USER_PASSWORD || 'password123';
            
            await exampleLoginPage.enterEmail(email);
            await exampleLoginPage.enterPassword(password);
        });

        await allure.step('3. Submit login form', async () => {
            await exampleLoginPage.clickSubmit();
        });

        await allure.step('4. Verify successful login', async () => {
            // Wait for redirect to dashboard/home page
            await exampleLoginPage.waitForSuccessfulLogin('/dashboard');
            
            // Verify success message or dashboard elements
            expect(await exampleLoginPage.isSuccessMessageVisible()).toBe(true);
            
            // Attach screenshot for verification
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-002: Login with Invalid Credentials', async ({ 
        page, 
        exampleLoginPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Login with Invalid Credentials",
            owner: "QA Automation Team",
            tags: ["login", "authentication", "negative", "validation"],
            severity: "normal",
            epic: "Authentication",
            feature: "Login",
            story: "Login Validation",
            parentSuite: "Authentication Suite",
            suite: "Login Tests",
            subSuite: "Negative Tests"
        });

        await allure.step('1. Enter invalid credentials', async () => {
            await exampleLoginPage.enterEmail('invalid@example.com');
            await exampleLoginPage.enterPassword('wrongpassword');
        });

        await allure.step('2. Submit login form', async () => {
            await exampleLoginPage.clickSubmit();
        });

        await allure.step('3. Verify error message is displayed', async () => {
            // Wait for error message to appear
            await page.waitForTimeout(1000); // Adjust based on your app's response time
            
            const errorVisible = await exampleLoginPage.isErrorMessageVisible();
            expect(errorVisible).toBe(true);
            
            if (errorVisible) {
                const errorText = await exampleLoginPage.getErrorMessage();
                expect(errorText).toContain('invalid'); // Adjust based on your error message
            }
            
            // Attach screenshot of error state
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-003: Forgot Password Link Functionality', async ({ 
        page, 
        exampleLoginPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Forgot Password Link Functionality",
            owner: "QA Automation Team",
            tags: ["login", "password", "recovery", "smoke"],
            severity: "normal",
            epic: "Authentication",
            feature: "Password Recovery",
            story: "Forgot Password",
            parentSuite: "Authentication Suite",
            suite: "Password Recovery Tests",
            subSuite: "Smoke Tests"
        });

        await allure.step('1. Verify forgot password link is visible', async () => {
            const forgotPasswordVisible = await exampleLoginPage.isElementVisible(
                exampleLoginPage.forgotPasswordLink
            );
            expect(forgotPasswordVisible).toBe(true);
        });

        await allure.step('2. Click on forgot password link', async () => {
            await exampleLoginPage.clickForgotPassword();
            await page.waitForLoadState('networkidle');
        });

        await allure.step('3. Verify redirect to password recovery page', async () => {
            // Verify URL contains password recovery path
            await exampleLoginPage.waitForURLContains('/forgot-password');
            // Or verify specific elements on password recovery page
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
