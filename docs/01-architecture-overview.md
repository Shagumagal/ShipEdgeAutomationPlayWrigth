# Architecture Overview

This document provides a comprehensive overview of the project architecture, design patterns, and code organization.

## Project Structure

The project follows a well-organized structure that separates concerns and promotes code reusability:

```
playwright-template-project/
├── lib/                      # Core utilities and base classes
│   ├── basepage.ts          # BasePage abstract class
│   ├── allure-helper.ts     # Allure reporting utilities
│   ├── helper-functions.ts  # Utility functions
│   ├── helpers-fixtures.ts  # Helper fixtures
│   ├── page-object-fixtures.ts  # Page object fixtures
│   ├── test-failure-capture.ts       # Test failure artifact capture utility
│   └── logger.ts            # Logging utility
├── page-objects/            # Page Object Model classes
│   ├── example-login-page.ts
│   ├── example-dashboard-page.ts
│   └── ...
├── tests/                   # Test specifications
│   ├── example-login.spec.ts
│   ├── example-dashboard.spec.ts
│   └── ...
├── data/                    # Test data and constants
│   └── example-data.json
├── playwright.config.ts     # Main Playwright configuration
└── playwright.service.config.ts  # Service configuration
```

## Page Object Model (POM) Pattern

The project implements the **Page Object Model** design pattern, which is a best practice for test automation. This pattern provides:

- **Separation of concerns**: UI locators and page interactions are separated from test logic
- **Code reusability**: Page methods can be reused across multiple tests
- **Maintainability**: Changes to UI elements only require updates in one place
- **Readability**: Tests read like user stories

### Architecture Flow

```
Test Files (.spec.ts)
    ↓ (use)
Page Objects (.page-objects/*.ts)
    ↓ (extend)
BasePage (lib/basepage.ts)
    ↓ (use)
Playwright Page API
```

## BasePage Class

All page objects extend the `BasePage` abstract class, which provides common functionality and a consistent interface. This base class is located in [`lib/basepage.ts`](../lib/basepage.ts).

### Key Features

- **Common timeout handling**: Default timeout of 15 seconds for all operations
- **Element interaction methods**: Click, type, select, hover, etc.
- **Visibility checks**: Methods to check if elements are visible or hidden
- **Wait utilities**: Methods to wait for elements, URLs, and page loads

### Example BasePage Usage

```typescript
import { Page, Locator } from '@playwright/test';
import BasePage from '../lib/basepage';

export class ExampleLoginPage extends BasePage {
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.getByRole('textbox', { name: 'Email' });
        this.passwordInput = page.getByRole('textbox', { name: 'Password' });
        this.submitButton = page.getByRole('button', { name: 'Submit' });
    }

    async enterEmail(email: string) {
        await this.type(this.emailInput, email);
    }

    async enterPassword(password: string) {
        await this.type(this.passwordInput, password);
    }

    async clickSubmit() {
        await this.click(this.submitButton);
    }
}
```

### BasePage Methods Reference

The BasePage class provides the following methods (see [Page Objects documentation](04-page-objects.md) for details):

- `waitForElementToBeVisible()` - Wait for element visibility
- `waitForElementToBeHidden()` - Wait for element to be hidden
- `isElementVisible()` - Check if element is visible
- `isElementNotVisible()` - Check if element is not visible
- `isElementEnabled()` - Check if element is enabled
- `click()` - Click on an element
- `type()` - Type text into an element
- `getText()` - Get inner text of an element
- `getAttribute()` - Get attribute value
- `waitForURLContains()` - Wait for URL to contain substring
- `selectOption()` - Select value from dropdown
- `hover()` - Hover over an element
- `uploadFile()` - Upload a file
- `assertElementText()` - Assert element text equals expected

## Fixtures Pattern

The project uses Playwright's fixtures pattern to provide dependencies to tests. This pattern allows for:

- **Dependency injection**: Page objects and utilities are automatically provided to tests
- **Test isolation**: Each test gets its own instances
- **Reusability**: Common setup logic is centralized

### Fixture Hierarchy

The project has two levels of fixtures:

1. **Helper Fixtures** (`lib/helpers-fixtures.ts`) - Base fixtures for common utilities
2. **Page Object Fixtures** (`lib/page-object-fixtures.ts`) - Fixtures that provide page object instances

### Helper Fixtures

Helper fixtures provide common test utilities:

```typescript
// lib/helpers-fixtures.ts
export const test = base.extend<helperFixture>({
    waitForPageLoad: async ({page}, use) => {
        await page.goto('/');
        await page.waitForLoadState('load', {timeout: 60000});
        await page.waitForLoadState('domcontentloaded', {timeout: 60000});
        await page.waitForLoadState('networkidle', {timeout: 60000});
        use(() => Promise.resolve());
    },

    saveAttachments: [async ({ page }, use, testInfo) => {
        // Auto-attach logs and screenshots on failure
        // ...
    }, { auto: true }],

    saveBrowserVersion: [async ({ browser, browserName }, use, testInfo) => {
        // Auto-save browser version
        // ...
    }, { auto: true }],
});
```

### Page Object Fixtures

Page object fixtures extend helper fixtures and provide page object instances:

```typescript
// lib/page-object-fixtures.ts
export const test = helperFixture.extend<pageObjectFixture>({
    exampleLoginPage: async ({page}, use) => {
        const exampleLoginPage = new ExampleLoginPage(page);
        use(exampleLoginPage);
    },
    exampleDashboardPage: async ({page}, use) => {
        const exampleDashboardPage = new ExampleDashboardPage(page);
        use(exampleDashboardPage);
    },
    // ... more page objects
});
```

### Using Fixtures in Tests

Tests automatically receive fixtures through dependency injection:

```typescript
import { test, expect } from './../lib/page-object-fixtures';

test('TC-001: Successful Login', async ({ 
    page, 
    exampleLoginPage,
    exampleDashboardPage, 
    waitForPageLoad,
    saveAttachments,
    saveBrowserVersion 
}) => {
    // All fixtures are automatically available
    await exampleLoginPage.navigateToLogin();
    await waitForPageLoad();
    // ...
});
```

## Code Organization Principles

### 1. Separation of Concerns

- **Locators** → Defined in Page Objects
- **Actions** → Methods in Page Objects
- **Test Logic** → High-level steps in Test Files

### 2. Single Responsibility

Each class and file has a single, well-defined purpose:
- Page Objects handle page-specific interactions
- BasePage provides common functionality
- Test files contain test scenarios only

### 3. DRY (Don't Repeat Yourself)

- Common functionality is in BasePage
- Reusable utilities are in helper files
- Test data is centralized in `constants.json`

### 4. Naming Conventions

- **Page Objects**: `example-{feature}-page.ts` (e.g., `example-login-page.ts`)
- **Test Files**: `example-{feature}.spec.ts` (e.g., `example-login.spec.ts`)
- **Methods**: camelCase with descriptive names (e.g., `clickSubmit()`)
- **Locators**: Descriptive names indicating element purpose (e.g., `emailInput`)

## Related Documentation

- [Page Objects](04-page-objects.md) - Detailed page object creation guidelines
- [Test Development](03-test-development.md) - How to write tests using this architecture
- [Configuration](02-configuration.md) - Project configuration details

