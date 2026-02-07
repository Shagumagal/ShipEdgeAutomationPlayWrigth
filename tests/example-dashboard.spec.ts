import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

/**
 * Example Dashboard Test Suite
 * 
 * This test demonstrates:
 * - Navigation testing
 * - Multiple Allure steps
 * - Element visibility checks
 * - Using helper functions
 * - Data extraction and validation
 * - Complex page interactions
 */
test.describe('Dashboard Functionality', () => {
    
    test.beforeEach(async ({ exampleLoginPage, exampleDashboardPage, waitForPageLoad }) => {
        // Login before accessing dashboard
        await exampleLoginPage.navigateToLogin();
        await waitForPageLoad();
        
        // Perform login (adjust credentials based on your .env file)
        const email = process.env.TEST_USER_EMAIL || 'test@example.com';
        const password = process.env.TEST_USER_PASSWORD || 'password123';
        
        await exampleLoginPage.login(email, password);
        await waitForPageLoad();
        
        // Wait for dashboard to load
        await exampleDashboardPage.waitForDashboardLoad();
    });

    test('TC-101: Dashboard Initial Display and Navigation', async ({ 
        page, 
        exampleDashboardPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Dashboard Initial Display and Navigation",
            owner: "QA Automation Team",
            tags: ["dashboard", "navigation", "smoke", "critical"],
            severity: "critical",
            epic: "Dashboard",
            feature: "Dashboard Display",
            story: "Dashboard Initial Load",
            parentSuite: "Dashboard Suite",
            suite: "Dashboard Tests",
            subSuite: "Smoke Tests"
        });

        await allure.step('1. Verify dashboard heading is visible', async () => {
            const headingVisible = await exampleDashboardPage.isDashboardHeadingVisible();
            expect(headingVisible).toBe(true);
        });

        await allure.step('2. Verify welcome message is displayed', async () => {
            const welcomeVisible = await exampleDashboardPage.isElementVisible(
                exampleDashboardPage.welcomeMessage
            );
            expect(welcomeVisible).toBe(true);
            
            if (welcomeVisible) {
                const welcomeText = await exampleDashboardPage.getWelcomeMessage();
                expect(welcomeText).toBeTruthy();
                console.log(`Welcome message: ${welcomeText}`);
            }
        });

        await allure.step('3. Verify all navigation links are present', async () => {
            const navigationComplete = await exampleDashboardPage.verifyNavigationLinks();
            expect(navigationComplete).toBe(true);
            
            // Verify individual links
            expect(await exampleDashboardPage.isHomeLinkVisible()).toBe(true);
            expect(await exampleDashboardPage.isProfileLinkVisible()).toBe(true);
            expect(await exampleDashboardPage.isSettingsLinkVisible()).toBe(true);
        });

        await allure.step('4. Verify dashboard widgets are displayed', async () => {
            const statsVisible = await exampleDashboardPage.isStatsCardVisible();
            expect(statsVisible).toBe(true);
            
            const activityVisible = await exampleDashboardPage.isRecentActivityVisible();
            expect(activityVisible).toBe(true);
        });

        await allure.step('5. Capture dashboard screenshot', async () => {
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-102: Dashboard Navigation Links Functionality', async ({ 
        page, 
        exampleDashboardPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Dashboard Navigation Links Functionality",
            owner: "QA Automation Team",
            tags: ["dashboard", "navigation", "regression"],
            severity: "normal",
            epic: "Dashboard",
            feature: "Navigation",
            story: "Navigation Links",
            parentSuite: "Dashboard Suite",
            suite: "Navigation Tests",
            subSuite: "Regression Tests"
        });

        await allure.step('1. Click on Profile link', async () => {
            await exampleDashboardPage.clickProfileLink();
            await page.waitForLoadState('networkidle');
            
            // Verify navigation to profile page
            await exampleDashboardPage.waitForURLContains('/profile');
            await AllureHelper.attachScreenShot(page);
        });

        await allure.step('2. Navigate back to dashboard', async () => {
            await exampleDashboardPage.navigateToDashboard();
            await exampleDashboardPage.waitForDashboardLoad();
        });

        await allure.step('3. Click on Settings link', async () => {
            await exampleDashboardPage.clickSettingsLink();
            await page.waitForLoadState('networkidle');
            
            // Verify navigation to settings page
            await exampleDashboardPage.waitForURLContains('/settings');
            await AllureHelper.attachScreenShot(page);
        });
    });

    test('TC-103: Dashboard User Greeting Display', async ({ 
        page, 
        exampleDashboardPage
    }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "Dashboard User Greeting Display",
            owner: "QA Automation Team",
            tags: ["dashboard", "user-interface", "smoke"],
            severity: "normal",
            epic: "Dashboard",
            feature: "User Interface",
            story: "User Greeting",
            parentSuite: "Dashboard Suite",
            suite: "UI Tests",
            subSuite: "Smoke Tests"
        });

        await allure.step('1. Verify user greeting is displayed', async () => {
            const greetingVisible = await exampleDashboardPage.isElementVisible(
                exampleDashboardPage.userGreeting
            );
            expect(greetingVisible).toBe(true);
        });

        await allure.step('2. Extract and validate greeting text', async () => {
            const greetingText = await exampleDashboardPage.getUserGreeting();
            expect(greetingText).toBeTruthy();
            expect(greetingText.length).toBeGreaterThan(0);
            
            // Log the greeting for debugging
            console.log(`User greeting: ${greetingText}`);
        });

        await allure.step('3. Verify notification badge if present', async () => {
            const badgeVisible = await exampleDashboardPage.isElementVisible(
                exampleDashboardPage.notificationsBadge
            );
            
            if (badgeVisible) {
                const notificationCount = await exampleDashboardPage.getNotificationCount();
                console.log(`Notification count: ${notificationCount}`);
                expect(notificationCount).toBeGreaterThanOrEqual(0);
            }
            
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
