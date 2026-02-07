# Test Development

This document provides guidelines for writing tests following the project's patterns and best practices.

## Test File Structure

Test files are located in the `tests/` directory and follow the naming convention: `{module}-{feature}.spec.ts`.

### Example: `charity-user-management.spec.ts`

```typescript
import { test, expect } from './../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";
import { faker } from '@faker-js/faker';
import constants from '../data/constants.json';

// Before hook - runs before each test
test.beforeEach(async ({ page, charityPortalLoginPage, waitForPageLoad }) => {
    await page.goto('/');
    await waitForPageLoad();
    await charityPortalLoginPage.clickOnLogInLink();
    await waitForPageLoad();
    await charityPortalLoginPage.typeOnEmailInput(process.env.CHARITY_PORTAL_USERNAME!);
    await charityPortalLoginPage.typeOnPasswordInput(process.env.CHARITY_PORTAL_PASSWORD!);
    await charityPortalLoginPage.clickOnContinueButton();
    await charityPortalLoginPage.waitForURLContains('/dashboard');
});

// Test case
test('CA-021 Add New User', async ({ 
    page, 
    charityPortalDashboardPage,
    charityPortalManageUsersPage, 
    waitForPageLoad,
    saveAttachments,
    saveBrowserVersion 
}) => {
    // Test metadata
    await AllureHelper.applyTestMetadata({
        displayName: "Add New User",
        owner: "QA Automation",
        tags: ["Charity Portal", "User Management", "Smoke"],
        severity: "critical",
        epic: "Charity Portal",
        feature: "User Management",
        story: "Add New User",
        parentSuite: "User Management",
        suite: "User Management",
        subSuite: "Regression"
    });
    allure.label('testlioManualTestID', 'b6035023-45cd-4be0-bd35-f1a80ff310d5');

    // Test steps using Allure steps
    await allure.step('1. Navigate to Manage Users page', async () => {
        await charityPortalDashboardPage.clickOnManageUsersLink();
        await waitForPageLoad();
        await charityPortalManageUsersPage.waitForURLContains('/users');
        expect(await charityPortalManageUsersPage.isManageUsersHeadingVisible()).toBe(true);
    });

    // More test steps...
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
test.beforeEach(async ({ page, charityPortalLoginPage, waitForPageLoad }) => {
    // Common setup steps
    await page.goto('/');
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
await charityPortalLoginPage.clickOnContinueButton();
```

## Test Metadata

All tests should include metadata for Allure reporting and Testlio integration.

### Applying Test Metadata

```typescript
await AllureHelper.applyTestMetadata({
    displayName: "Add New User",           // Test display name
    owner: "QA Automation",                 // Test owner
    tags: ["Charity Portal", "User Management", "Smoke"],  // Tags
    severity: "critical",                    // Severity level
    epic: "Charity Portal",                  // Epic
    feature: "User Management",              // Feature
    story: "Add New User",                   // User story
    parentSuite: "User Management",          // Parent suite
    suite: "User Management",                // Suite
    subSuite: "Regression"                   // Sub-suite
});
```

### Testlio Manual Test ID

Link automated tests to manual test cases:

```typescript
allure.label('testlioManualTestID', 'b6035023-45cd-4be0-bd35-f1a80ff310d5');
```

## Test Steps with Allure

Break tests into logical steps using Allure steps:

```typescript
await allure.step('1. Navigate to Manage Users page', async () => {
    await charityPortalDashboardPage.clickOnManageUsersLink();
    await waitForPageLoad();
    await charityPortalManageUsersPage.waitForURLContains('/users');
    expect(await charityPortalManageUsersPage.isManageUsersHeadingVisible()).toBe(true);
});

await allure.step('2. Click on Add User button', async () => {
    await charityPortalManageUsersPage.clickOnAddUserButton();
    await waitForPageLoad();
});
```

Benefits:
- Better test reports with step-by-step breakdown
- Easier debugging when tests fail
- Clear test flow documentation

## Test Data Management

### Using Constants

Static test data is stored in [`data/constants.json`](../data/constants.json):

```typescript
import constants from '../data/constants.json';

// Use constants
await charityPortalManageUsersPage.typeInFirstNameInput(
    constants.userManagementData.firstName
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
await charityPortalLoginPage.typeOnEmailInput(
    process.env.CHARITY_PORTAL_USERNAME!
);
await charityPortalLoginPage.typeOnPasswordInput(
    process.env.CHARITY_PORTAL_PASSWORD!
);
```

## Assertions

Use Playwright's `expect` API for assertions:

```typescript
// Visibility assertions
expect(await charityPortalManageUsersPage.isManageUsersHeadingVisible()).toBe(true);

// Text assertions
expect(await page.getByText('User added successfully')).toBeVisible();

// URL assertions
await charityPortalManageUsersPage.waitForURLContains('/users');

// Element state assertions
expect(await page.getByRole('button', { name: 'Submit' })).toBeEnabled();
```

## Waiting Strategies

### Using waitForPageLoad Fixture

The project provides a `waitForPageLoad` fixture that waits for multiple load states:

```typescript
await charityPortalDashboardPage.clickOnManageUsersLink();
await waitForPageLoad();  // Waits for load, DOMContentLoaded, and networkidle
```

### Using Page Object Wait Methods

Page objects extend BasePage which provides wait methods:

```typescript
// Wait for URL
await charityPortalManageUsersPage.waitForURLContains('/users');

// Wait for element visibility (in page object)
await this.waitForElementToBeVisible(this.manageUsersHeading);
```

### Explicit Waits

Use explicit waits when needed:

```typescript
await page.waitForTimeout(2500);  // Use sparingly, prefer waitForLoadState
await page.waitForLoadState('networkidle');
```

## Test Naming Conventions

- **Test IDs**: Use format like `CA-021`, `CA-022` (from test case management system)
- **Descriptive names**: Test names should describe what is being tested
- **Consistent format**: Follow existing naming patterns

Example:
```typescript
test('CA-021 Add New User', async ({ ... }) => { ... });
test('CA-022 Resend User Invite', async ({ ... }) => { ... });
test('CA-023 Edit User Information', async ({ ... }) => { ... });
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
test.beforeEach(async ({ page, charityPortalLoginPage, waitForPageLoad }) => {
    await page.goto('/');
    await waitForPageLoad();
    await charityPortalLoginPage.clickOnLogInLink();
    await waitForPageLoad();
    await charityPortalLoginPage.typeOnEmailInput(process.env.CHARITY_PORTAL_USERNAME!);
    await charityPortalLoginPage.typeOnPasswordInput(process.env.CHARITY_PORTAL_PASSWORD!);
    await charityPortalLoginPage.clickOnContinueButton();
    await charityPortalLoginPage.waitForURLContains('/dashboard');
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


















