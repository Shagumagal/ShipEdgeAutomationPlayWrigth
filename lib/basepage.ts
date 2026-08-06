import { Page, Locator, FrameLocator, expect } from '@playwright/test';

export default abstract class BasePage {
  public page: Page;

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

  /**
   * Waits for the Xenvio loading spinner (rotating favicon) to disappear.
   * Useful for long-running operations like Get Rates or Save & Confirm.
   */
  async waitForXenvioLoading(timeoutMs = 30000): Promise<void> {
    const loader = this.page.locator('img.rotating-favicon, .loading-overlay, app-loading').first();
    
    // We wait up to 2s for it to appear (incase it's delayed)
    try {
        if (await loader.isVisible()) {
             // Already visible, do nothing just proceed to wait for hidden
        } else {
             await loader.waitFor({ state: 'visible', timeout: 2000 });
        }
    } catch {
        // Did not appear, maybe too fast
    }
    
    // Now wait for it to disappear
    await loader.waitFor({ state: 'hidden', timeout: timeoutMs });
  }

  // ─── PrimeNG Helpers ─────────────────────────────────────────────

  /**
   * Select a value from a PrimeNG p-select dropdown.
   * Clicks the select to open the overlay, then clicks the matching option.
   * @param selectLocator The p-select element or its rendered container
   * @param optionText The visible text of the option to select (partial match)
   */
  async selectPrimeNGDropdown(selectLocator: Locator, optionText: string, timeout = 5000): Promise<void> {
    await this.waitForElementToBeVisible(selectLocator, timeout);
    await selectLocator.click();
    await this.page.waitForTimeout(400);

    // PrimeNG renders options in an overlay panel with role="listbox"
    const option = this.page
      .locator('.p-select-overlay li, .p-listbox-option, .p-select-option, [role="option"]')
      .filter({ hasText: new RegExp(optionText, 'i') })
      .first();

    await option.waitFor({ state: 'visible', timeout });
    await option.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Wait for a PrimeNG DynamicDialog modal to be visible.
   * Returns the dialog locator for scoped interactions.
   */
  async waitForPrimeNGDialog(timeout = 10000): Promise<Locator> {
    const dialog = this.page.locator('.p-dialog, [role="dialog"]').last();
    await dialog.waitFor({ state: 'visible', timeout });
    await this.page.waitForTimeout(300);
    return dialog;
  }

  /**
   * Fill a PrimeNG p-autoComplete field and select the first matching suggestion.
   * @param inputLocator The p-autoComplete element or its input
   * @param text The text to type
   * @param selectFirst Whether to select the first suggestion (default true)
   */
  async fillPrimeNGAutoComplete(inputLocator: Locator, text: string, selectFirst = true): Promise<void> {
    // The actual input inside p-autoComplete
    const input = inputLocator.locator('input').first();
    const target = (await input.count() > 0) ? input : inputLocator;

    await target.click();
    await target.clear();
    await target.pressSequentially(text, { delay: 80 });
    await this.page.waitForTimeout(800);

    if (selectFirst) {
      const suggestion = this.page
        .locator('.p-autocomplete-overlay li, .p-autocomplete-item, .p-autocomplete-option')
        .first();
      try {
        await suggestion.waitFor({ state: 'visible', timeout: 5000 });
        await suggestion.click();
        await this.page.waitForTimeout(300);
      } catch {
        // No suggestions appeared — value stays as typed
        console.log(`  ⚠ No autocomplete suggestions for "${text}", keeping typed value`);
        await target.press('Tab');
      }
    }
  }
}
