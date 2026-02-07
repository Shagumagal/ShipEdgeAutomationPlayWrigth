# Troubleshooting Guide

This guide covers common issues and solutions when working with the Playwright automation framework.

## Common Issues and Solutions

### Tests Fail Immediately

**Symptoms:** Tests fail right after starting, often with timeout or connection errors.

**Solutions:**
1. **Check BASE_URL:**
   ```bash
   # Verify your .env file has the correct URL
   echo $BASE_URL
   # Or check playwright.config.ts
   ```

2. **Verify Application is Accessible:**
   ```bash
   # Test if the application is reachable
   curl https://your-app.com
   ```

3. **Check Network Connectivity:**
   - Ensure you can access the application in a browser
   - Check firewall settings
   - Verify VPN connection if required

4. **Verify Environment Variables:**
   ```bash
   # Ensure .env file exists and is loaded
   cat .env
   ```

### Element Not Found Errors

**Symptoms:** Tests fail with "Element not found" or "Locator not found" errors.

**Solutions:**
1. **Check Locator Strategy:**
   - Use Playwright's recommended locators (getByRole, getByText, etc.)
   - Avoid XPath when possible
   - Verify element is actually present on the page

2. **Add Explicit Waits:**
   ```typescript
   // Wait for element to be visible before interacting
   await page.waitForSelector('your-selector');
   // Or use BasePage method
   await basePage.waitForElementToBeVisible(locator);
   ```

3. **Check if Element is in iframe:**
   ```typescript
   // If element is in iframe, use frameLocator
   const frame = page.frameLocator('iframe-selector');
   await frame.getByRole('button').click();
   ```

4. **Verify Element is Not Hidden:**
   ```typescript
   // Check element visibility
   const isVisible = await locator.isVisible();
   ```

### Timeout Errors

**Symptoms:** Tests timeout waiting for elements or page loads.

**Solutions:**
1. **Increase Timeout:**
   ```typescript
   // In playwright.config.ts
   timeout: 1000 * 60 * 10, // 10 minutes
   
   // Or per test
   test.setTimeout(60000); // 60 seconds
   ```

2. **Check Network Conditions:**
   - Slow network can cause timeouts
   - Consider using `slowMo` for debugging
   - Check if API calls are slow

3. **Use Appropriate Wait Strategies:**
   ```typescript
   // Wait for specific state
   await page.waitForLoadState('networkidle');
   await page.waitForLoadState('domcontentloaded');
   ```

### Flaky Tests

**Symptoms:** Tests pass sometimes and fail other times without code changes.

**Solutions:**
1. **Add Explicit Waits:**
   ```typescript
   // Wait for element before interaction
   await locator.waitFor({ state: 'visible' });
   ```

2. **Use Retries:**
   ```typescript
   // In playwright.config.ts
   retries: process.env.CI ? 2 : 0,
   ```

3. **Avoid Hard-coded Waits:**
   ```typescript
   // Bad
   await page.waitForTimeout(5000);
   
   // Good
   await page.waitForLoadState('networkidle');
   await locator.waitFor({ state: 'visible' });
   ```

4. **Check for Race Conditions:**
   - Ensure proper sequencing of actions
   - Wait for previous actions to complete
   - Use `waitForPageLoad` fixture when needed

### Browser Not Found Errors

**Symptoms:** Error message about browser not being installed.

**Solutions:**
```bash
# Install all browsers (recommended for parallel execution)
npx playwright install chromium msedge firefox webkit --with-deps

# Install specific browser
npx playwright install chromium --with-deps
npx playwright install msedge --with-deps
npx playwright install firefox --with-deps
npx playwright install webkit --with-deps

# Install without system dependencies (if dependencies already installed)
npx playwright install chromium msedge firefox webkit
```

**Note**: For parallel test execution across multiple browsers, install all browsers. See [Multi-Browser Setup](#multi-browser-setup-for-parallel-execution) in README.md for details.

### Allure Report Not Generating

**Symptoms:** Allure report doesn't generate or shows empty results.

**Solutions:**
1. **Check Allure Results Directory:**
   ```bash
   # Verify allure-results directory exists and has files
   ls -la allure-results/
   ```

2. **Generate Report:**
   ```bash
   npm run allure:generate
   ```

3. **Check Allure Installation:**
   ```bash
   # Verify allure-commandline is installed
   npm list allure-commandline
   ```

4. **Clean and Regenerate:**
   ```bash
   # Remove old results and report
   rm -rf allure-results allure-report
   # Run tests again
   npm run test:smoke-chrome
   # Generate report
   npm run allure:generate
   ```

### Environment Variables Not Loading

**Symptoms:** Tests fail because environment variables are undefined.

**Solutions:**
1. **Check .env File:**
   ```bash
   # Ensure .env file exists in project root
   ls -la .env
   ```

2. **Verify dotenv Configuration:**
   ```typescript
   // In playwright.config.ts
   import dotenv from 'dotenv'
   dotenv.config({ path: path.resolve(__dirname, '.env') });
   ```

3. **Check Variable Names:**
   ```bash
   # Variable names are case-sensitive
   # Use exact names as in .env file
   ```

### Tests Run Slowly

**Symptoms:** Tests take too long to execute.

**Solutions:**
1. **Enable Parallel Execution:**
   ```typescript
   // In playwright.config.ts
   fullyParallel: true,
   workers: process.env.CI ? 1 : 4, // Adjust based on your machine
   ```

2. **Reduce Timeouts:**
   ```typescript
   // Use appropriate timeouts, not too high
   timeout: 30000, // 30 seconds instead of 5 minutes
   ```

3. **Optimize Waits:**
   - Use specific waits instead of generic ones
   - Avoid unnecessary `waitForTimeout`
   - Use `waitForLoadState` appropriately

4. **Run Tests in Headless Mode:**
   ```typescript
   headless: true, // Faster than headed mode
   ```

### Screenshots Not Attaching

**Symptoms:** Screenshots don't appear in test reports.

**Solutions:**
1. **Check Screenshot Configuration:**
   ```typescript
   // In playwright.config.ts
   screenshot: 'only-on-failure', // or 'on'
   ```

2. **Verify Screenshot Path:**
   ```bash
   # Check test-results directory
   ls -la test-results/
   ```

3. **Use Allure Helper:**
   ```typescript
   // Explicitly attach screenshot
   await AllureHelper.attachScreenShot(page);
   ```

### TypeScript Errors

**Symptoms:** TypeScript compilation errors.

**Solutions:**
1. **Check TypeScript Version:**
   ```bash
   npm list typescript
   ```

2. **Verify tsconfig.json:**
   ```bash
   # Ensure tsconfig.json exists
   ls -la tsconfig.json
   ```

3. **Run Type Check:**
   ```bash
   npx tsc --noEmit
   ```

### CI/CD Pipeline Failures

**Symptoms:** Tests pass locally but fail in CI/CD.

**Solutions:**
1. **Check Environment Variables:**
   - Verify GitHub Secrets are set correctly
   - Ensure environment variables match local setup

2. **Check Browser Installation:**
   ```yaml
   # In GitHub Actions workflow
   - name: Install Playwright Browsers
     run: npx playwright install chromium msedge firefox webkit --with-deps
   ```
   
   **Note**: For parallel execution, install all browsers. See [Multi-Browser Setup](12-multi-browser-setup.md) for details.

3. **Verify Timeouts:**
   - CI environments may be slower
   - Increase timeouts if needed

4. **Check Logs:**
   - Review GitHub Actions logs
   - Look for specific error messages
   - Check artifact uploads

## Debugging Tips

### Run Tests in Debug Mode

```bash
# Run with Playwright Inspector
PWDEBUG=1 npx playwright test

# Run in headed mode to see browser
npx playwright test --headed

# Run with UI mode
npx playwright test --ui
```

### Use Console Logs

```typescript
// Add console logs for debugging
console.log('Current URL:', page.url());
console.log('Element visible:', await locator.isVisible());

// Or use Playwright's page.on('console')
page.on('console', msg => console.log('Browser:', msg.text()));
```

### Use Trace Viewer

```typescript
// Enable trace in config
trace: 'on-first-retry', // or 'on'

// View trace
npx playwright show-trace trace.zip
```

### Check Network Requests

```typescript
// Monitor network requests
page.on('request', request => console.log('Request:', request.url()));
page.on('response', response => console.log('Response:', response.url(), response.status()));
```

## Getting Help

If you encounter issues not covered here:

1. Check [Playwright Documentation](https://playwright.dev/docs/intro)
2. Review test examples in `tests/` directory
3. Check page object examples in `page-objects/` directory
4. Review [Test Development Guide](03-test-development.md)
5. Check [Configuration Guide](02-configuration.md)
