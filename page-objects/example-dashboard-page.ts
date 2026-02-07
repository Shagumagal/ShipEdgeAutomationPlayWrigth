import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

/**
 * Example Dashboard Page Object
 * 
 * This demonstrates:
 * - Complex page with multiple sections
 * - Navigation elements
 * - Widget/card interactions
 * - Data extraction methods
 * - Multiple interaction patterns
 */
export class ExampleDashboardPage extends BasePage {
    // Navigation locators
    readonly dashboardHeading: Locator;
    readonly homeLink: Locator;
    readonly profileLink: Locator;
    readonly settingsLink: Locator;
    readonly logoutButton: Locator;
    
    // Dashboard content locators
    readonly welcomeMessage: Locator;
    readonly userGreeting: Locator;
    readonly statsCard: Locator;
    readonly recentActivitySection: Locator;
    readonly notificationsBadge: Locator;
    
    // Widget locators
    readonly widgetTitle: Locator;
    readonly widgetContent: Locator;
    readonly actionButton: Locator;

    constructor(page: Page) {
        super(page);
        
        // Navigation elements
        this.dashboardHeading = page.getByRole('heading', { name: /dashboard|home|welcome/i });
        this.homeLink = page.getByRole('link', { name: /home/i });
        this.profileLink = page.getByRole('link', { name: /profile|account/i });
        this.settingsLink = page.getByRole('link', { name: /settings|preferences/i });
        this.logoutButton = page.getByRole('button', { name: /log out|sign out/i });
        
        // Dashboard content
        this.welcomeMessage = page.getByText(/welcome|hello|greetings/i);
        this.userGreeting = page.getByText(/hi|hello/i).first();
        this.statsCard = page.locator('[data-testid="stats-card"]').first();
        this.recentActivitySection = page.getByRole('region', { name: /recent activity|activity/i });
        this.notificationsBadge = page.locator('[data-testid="notifications-badge"]');
        
        // Widgets
        this.widgetTitle = page.getByRole('heading', { name: /widget|card/i });
        this.widgetContent = page.locator('[class*="widget"], [class*="card"]');
        this.actionButton = page.getByRole('button', { name: /action|view|more/i });
    }

    /**
     * Navigate to dashboard
     */
    async navigateToDashboard() {
        await this.page.goto('/dashboard');
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Click on home link
     */
    async clickHomeLink() {
        await this.click(this.homeLink);
    }

    /**
     * Click on profile link
     */
    async clickProfileLink() {
        await this.click(this.profileLink);
    }

    /**
     * Click on settings link
     */
    async clickSettingsLink() {
        await this.click(this.settingsLink);
    }

    /**
     * Click logout button
     */
    async clickLogout() {
        await this.click(this.logoutButton);
    }

    /**
     * Get welcome message text
     */
    async getWelcomeMessage(): Promise<string> {
        return await this.getText(this.welcomeMessage);
    }

    /**
     * Get user greeting text
     */
    async getUserGreeting(): Promise<string> {
        return await this.getText(this.userGreeting);
    }

    /**
     * Check if dashboard heading is visible
     */
    async isDashboardHeadingVisible(): Promise<boolean> {
        return await this.isElementVisible(this.dashboardHeading);
    }

    /**
     * Check if home link is visible
     */
    async isHomeLinkVisible(): Promise<boolean> {
        return await this.isElementVisible(this.homeLink);
    }

    /**
     * Check if profile link is visible
     */
    async isProfileLinkVisible(): Promise<boolean> {
        return await this.isElementVisible(this.profileLink);
    }

    /**
     * Check if settings link is visible
     */
    async isSettingsLinkVisible(): Promise<boolean> {
        return await this.isElementVisible(this.settingsLink);
    }

    /**
     * Check if stats card is visible
     */
    async isStatsCardVisible(): Promise<boolean> {
        return await this.isElementVisible(this.statsCard);
    }

    /**
     * Check if recent activity section is visible
     */
    async isRecentActivityVisible(): Promise<boolean> {
        return await this.isElementVisible(this.recentActivitySection);
    }

    /**
     * Get notification count from badge
     */
    async getNotificationCount(): Promise<number> {
        const badgeText = await this.getText(this.notificationsBadge);
        const count = parseInt(badgeText.replace(/\D/g, ''), 10);
        return isNaN(count) ? 0 : count;
    }

    /**
     * Wait for dashboard to load completely
     */
    async waitForDashboardLoad() {
        await this.waitForElementToBeVisible(this.dashboardHeading);
        await this.page.waitForLoadState('networkidle');
    }

    /**
     * Verify all main navigation links are present
     */
    async verifyNavigationLinks(): Promise<boolean> {
        const homeVisible = await this.isHomeLinkVisible();
        const profileVisible = await this.isProfileLinkVisible();
        const settingsVisible = await this.isSettingsLinkVisible();
        return homeVisible && profileVisible && settingsVisible;
    }
}
