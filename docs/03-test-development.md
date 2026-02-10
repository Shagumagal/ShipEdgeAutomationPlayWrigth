# Test Development

This document provides guidelines for writing tests following the project's patterns and best practices.

## Test File Structure

Test files are located in the `tests/` directory and follow the naming convention: `{module}-{feature}.spec.ts`.

### Example: `example-login.spec.ts`

```typescript
import { test, expect } from './../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

// Before hook - runs before each test
test.beforeEach(async ({ exampleLoginPage, waitForPageLoad }) => {
    await exampleLoginPage.navigateToLogin();
    await waitForPageLoad();
});

// Test case
test('TC-001: Successful Login with Valid Credentials', async ({ 
    page, 
    exampleLoginPage,
    waitForPageLoad
}) => {
    // Test metadata
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

    // Test steps using Allure steps
    await allure.step('1. Verify login page elements are visible', async () => {
        expect(await exampleLoginPage.isEmailInputVisible()).toBe(true);
        expect(await exampleLoginPage.isPasswordInputVisible()).toBe(true);
    });

    await allure.step('2. Enter valid credentials', async () => {
        const email = process.env.TEST_USER_EMAIL || 'test@example.com';
        const password = process.env.TEST_USER_PASSWORD || 'password123';
        await exampleLoginPage.enterEmail(email);
        await exampleLoginPage.enterPassword(password);
    });

    await allure.step('3. Submit login form', async () => {
        await exampleLoginPage.clickSubmit();
    });

    await allure.step('4. Verify successful login', async () => {
        await exampleLoginPage.waitForSuccessfulLogin('/dashboard');
        expect(await exampleLoginPage.isSuccessMessageVisible()).toBe(true);
        await AllureHelper.attachScreenShot(page);
    });
});

// After hook - runs after each test
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const error = new Error(`Test failed with status: ${testInfo.status}`);
        await captureTestFailure(page, testInfo, error);
    }
});
```

## Test Structure Guidelines

### 1. Imports

Always import from the page object fixtures:

```typescript
import { test, expect } from './../lib/page-object-fixtures';
```

Additional imports as needed:
- `AllureHelper` for test metadata
- `allure` for test steps
- `captureTestFailure` for error handling
- `faker` for test data generation
- `constants` for static test data

### 2. Test Hooks

#### beforeEach Hook

Use `beforeEach` for common setup (e.g., login):

```typescript
test.beforeEach(async ({ exampleLoginPage, waitForPageLoad }) => {
    // Common setup steps
    await exampleLoginPage.navigateToLogin();
    await waitForPageLoad();
    // ... login steps
});
```

#### afterEach Hook

Use `afterEach` for cleanup and error capture:

```typescript
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const error = new Error(`Test failed with status: ${testInfo.status}`);
        await captureTestFailure(page, testInfo, error);
    }
});
```

### 3. Test Function Structure

Tests should follow this structure:

1. **Test metadata** - Apply Allure metadata
2. **Test steps** - Use Allure steps for each action
3. **Assertions** - Use Playwright's `expect` API

## Locator Strategy

The project follows Playwright's recommended locator priority order. **Always use this order when selecting locators:**

### Locator Priority (Highest to Lowest)

1. **`getByRole()`** - Most reliable, uses accessibility attributes
   ```typescript
   page.getByRole('button', { name: 'Submit' })
   page.getByRole('textbox', { name: 'Email address' })
   ```

2. **`getByText()`** - Match visible text
   ```typescript
   page.getByText('Welcome, John!')
   ```

3. **`getByLabel()`** - Match form labels
   ```typescript
   page.getByLabel('User Name')
   ```

4. **`getByPlaceholder()`** - Match placeholder text
   ```typescript
   page.getByPlaceholder('Enter your email')
   ```

5. **`getByAltText()`** - Match alt text for images
   ```typescript
   page.getByAltText('Company logo')
   ```

6. **`getByTitle()`** - Match title attribute
   ```typescript
   page.getByTitle('Close dialog')
   ```

7. **`getByTestId()`** - Match test ID attribute (configured as "jhi")
   ```typescript
   page.getByTestId('submit-button')
   ```

8. **`locator()`** - CSS selector or XPath (use as last resort)
   ```typescript
   page.locator('input[type="email"]')
   ```

### Locator Best Practices

- **Avoid XPath**: Use CSS selectors or Playwright's built-in locators
- **Prefer semantic locators**: `getByRole()` is more maintainable than CSS selectors
- **Use text content carefully**: Text-based locators can break if UI text changes
- **Combine locators**: Use filters and chaining for complex selections
  ```typescript
  page.getByRole('button').filter({ hasText: 'Save' })
  ```

### Important: No Direct Locators in Tests

**Never use locators directly in test files.** Always use page object methods:

```typescript
// ❌ BAD - Direct locator usage
await page.getByRole('button', { name: 'Submit' }).click();

// ✅ GOOD - Use page object method
await exampleLoginPage.clickSubmit();
```

## Test Metadata

All tests should include metadata for Allure reporting.

### Applying Test Metadata

```typescript
await AllureHelper.applyTestMetadata({
    displayName: "Successful Login",        // Test display name
    owner: "QA Automation Team",            // Test owner
    tags: ["login", "authentication", "smoke"],  // Tags
    severity: "critical",                  // Severity level
    epic: "Authentication",               // Epic
    feature: "Login",                      // Feature
    story: "User Login",                   // User story
    parentSuite: "Authentication Suite",  // Parent suite
    suite: "Login Tests",                  // Suite
    subSuite: "Positive Tests"             // Sub-suite
});
```

## Test Steps with Allure

Break tests into logical steps using Allure steps:

```typescript
await allure.step('1. Verify login page elements are visible', async () => {
    expect(await exampleLoginPage.isEmailInputVisible()).toBe(true);
    expect(await exampleLoginPage.isPasswordInputVisible()).toBe(true);
});

await allure.step('2. Enter valid credentials', async () => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'password123';
    await exampleLoginPage.enterEmail(email);
    await exampleLoginPage.enterPassword(password);
});
```

Benefits:
- Better test reports with step-by-step breakdown
- Easier debugging when tests fail
- Clear test flow documentation

## Test Data Management

### Using Constants

Static test data is stored in [`data/example-data.json`](../data/example-data.json):

```typescript
import exampleData from '../data/example-data.json';

// Use constants
await exampleDashboardPage.enterUserData(
    exampleData.userData.firstName
);
```

### Using Faker for Dynamic Data

Generate dynamic test data using Faker:

```typescript
import { faker } from '@faker-js/faker';

// Generate email
const emailAddress = faker.internet.email({
    firstName: 'steven',
    lastName: 'granados',
    provider: 'testlio.com'
});

// Generate names
const firstName = faker.person.firstName();
const lastName = faker.person.lastName();
```

### Using Environment Variables

For credentials and sensitive data:

```typescript
const email = process.env.TEST_USER_EMAIL || 'test@example.com';
const password = process.env.TEST_USER_PASSWORD || 'password123';

await exampleLoginPage.enterEmail(email);
await exampleLoginPage.enterPassword(password);
```

## Assertions

Use Playwright's `expect` API for assertions:

```typescript
// Visibility assertions
expect(await exampleLoginPage.isEmailInputVisible()).toBe(true);

// Text assertions
expect(await page.getByText('Login successful')).toBeVisible();

// URL assertions
await exampleLoginPage.waitForURLContains('/dashboard');

// Element state assertions
expect(await page.getByRole('button', { name: 'Submit' })).toBeEnabled();
```

## Waiting Strategies

### Using waitForPageLoad Fixture

The project provides a `waitForPageLoad` fixture that waits for multiple load states:

```typescript
await exampleDashboardPage.navigateToDashboard();
await waitForPageLoad();  // Waits for load, DOMContentLoaded, and networkidle
```

### Using Page Object Wait Methods

Page objects extend BasePage which provides wait methods:

```typescript
// Wait for URL
await exampleLoginPage.waitForURLContains('/dashboard');

// Wait for element visibility (in page object)
await this.waitForElementToBeVisible(this.dashboardHeading);
```

### Explicit Waits

Use explicit waits when needed:

```typescript
await page.waitForTimeout(2500);  // Use sparingly, prefer waitForLoadState
await page.waitForLoadState('networkidle');
```

## Test Naming Conventions

- **Test IDs**: Use format like `TC-001`, `TC-002` (test case identifiers)
- **Descriptive names**: Test names should describe what is being tested
- **Consistent format**: Follow existing naming patterns

Example:
```typescript
test('TC-001: Successful Login with Valid Credentials', async ({ ... }) => { ... });
test('TC-002: Login with Invalid Credentials', async ({ ... }) => { ... });
test('TC-003: Forgot Password Link Functionality', async ({ ... }) => { ... });
```

## Best Practices

1. **One assertion per step**: Keep steps focused and clear
2. **Use page object methods**: Never use locators directly in tests
3. **Wait for page loads**: Always use `waitForPageLoad()` after navigation
4. **Use Allure steps**: Break tests into logical steps
5. **Handle failures**: Use `afterEach` hook to capture failure artifacts
6. **Keep tests independent**: Each test should be able to run standalone
7. **Use descriptive step names**: Step names should clearly describe the action
8. **Avoid hard-coded waits**: Prefer waiting for conditions over fixed timeouts

## Common Patterns

### Pattern: Login Before Each Test

```typescript
test.beforeEach(async ({ exampleLoginPage, waitForPageLoad }) => {
    await exampleLoginPage.navigateToLogin();
    await waitForPageLoad();
    
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'password123';
    
    await exampleLoginPage.enterEmail(email);
    await exampleLoginPage.enterPassword(password);
    await exampleLoginPage.clickSubmit();
    await exampleLoginPage.waitForSuccessfulLogin('/dashboard');
});
```

### Pattern: Error Handling

```typescript
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const error = new Error(`Test failed with status: ${testInfo.status}`);
        await captureTestFailure(page, testInfo, error);
    }
});
```

### Pattern: Screenshot on Failure

```typescript
await AllureHelper.attachScreenShot(page);
```

## Related Documentation

- [Page Objects](04-page-objects.md) - Creating page objects for your tests
- [Architecture Overview](01-architecture-overview.md) - Understanding the project structure
- [Configuration](02-configuration.md) - Configuration details
- [Reporting](07-reporting.md) - Understanding test reports


















