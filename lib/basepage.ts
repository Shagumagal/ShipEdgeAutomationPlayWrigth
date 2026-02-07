import { Page, Locator, FrameLocator, expect } from '@playwright/test';

export default abstract class BasePage {
  protected page: Page;

  protected readonly defaultTimeout = 15000;

  /**
   * @param page Playwright Page object
   */
  protected constructor(page: Page) {
    this.page = page;
  }

  /**
   * Wait for a web element to be visible on the page.
   */
  async waitForElementToBeVisible(locator: Locator, timeout?: number): Promise<void> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    await locator.waitFor({ state: 'visible', timeout: effectiveTimeout });
  }

  /**
   * Wait for a web element to be hidden or detached.
   */
  async waitForElementToBeHidden(locator: Locator, timeout?: number): Promise<void> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    await locator.waitFor({ state: 'hidden', timeout: effectiveTimeout });
  }

  /**
   * Is web element displayed
   */
  async isElementVisible(locator: Locator, timeout?: number): Promise<boolean> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    try {
      await locator.waitFor({ state: 'visible', timeout: effectiveTimeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Is web element not displayed
   */
  async isElementNotVisible(locator: Locator, timeout?: number): Promise<boolean> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    try {
      await locator.waitFor({ state: 'hidden', timeout: effectiveTimeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Is web element visible
   */
  async isElementEnabled(locator: Locator, timeout?: number): Promise<boolean> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    return await locator.isEnabled({ timeout: effectiveTimeout });
  }

  /**
   * Click on web element
   */
  async click(locator: Locator, waitForPageLoad = false): Promise<void> {
    await locator.focus();
    await locator.click();
    if (waitForPageLoad) { // to wait for page load after click
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Type text into web element
   */
  async type(locator: Locator, text: string, waitForPageLoad = false): Promise<void> {
    await locator.focus();
    await locator.fill('');
    await locator.fill(text);
    if (waitForPageLoad) { // to wait for page load after entering the value
      await locator.press('Tab');
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Get inner text of an element
   */
  async getText(locator: Locator): Promise<string> {
    await locator.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    return await locator.innerText();
  }

  /**
   * Get attribute of an element
   */
  async getAttribute(locator: Locator, attribute: string): Promise<string | null> {
    await locator.waitFor({ state: 'attached', timeout: this.defaultTimeout });
    return await locator.getAttribute(attribute);
  }

  /**
   * Wait for the URL to contain a specific substring
   */
  async waitForURLContains(substring: string, timeout?: number): Promise<void> {
    const effectiveTimeout = timeout ?? 10000;
    await this.page.waitForURL(url => url.toString().includes(substring), { timeout: effectiveTimeout });
  }

  /**
   * Wait for a selector with retries if needed
   */
  async waitForSelectorWithRetry(selector: string, timeout?: number): Promise<Locator> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout: effectiveTimeout });
    return locator;
  }

  /**
   * Select value from dropdown in <Select>
   */
  async selectOption(locator: Locator, value: string): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    await locator.selectOption({ value });
  }

  /**
   * Hover over an element
   */
  async hover(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    await locator.hover();
  }

  /**
   * Press a key on an element
   */
  async pressKey(locator: Locator, key: string): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    await locator.press(key);
  }

  /**
   * Upload file
   */
  async uploadFile(locator: Locator, filePath: string): Promise<void> {
    await locator.setInputFiles(filePath);
  }

  /**
   * Switch to iframe
   */
  getFrameLocator(selector: string): FrameLocator {
    return this.page.frameLocator(selector);
  }

  /**
   * Assert element text equals expected
   */
  async assertElementText(locator: Locator, expectedText: string): Promise<void> {
    await expect(locator).toHaveText(expectedText, { timeout: this.defaultTimeout });
  }
}
