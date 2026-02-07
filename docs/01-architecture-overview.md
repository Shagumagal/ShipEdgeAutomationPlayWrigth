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
│   ├── charity-portal-login-page.ts
│   ├── charity-portal-dashboard-page.ts
│   └── ...
├── tests/                   # Test specifications
│   ├── charity-user-management.spec.ts
│   ├── charity-dashboard.spec.ts
│   └── ...
├── data/                    # Test data and constants
│   └── constants.json
├── testlio-cli/             # Testlio configuration
│   ├── project-config.json
│   └── test-config.json
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

export class CharityPortalLoginPage extends BasePage {
    readonly emailInputField: Locator;
    readonly passwordInputField: Locator;
    readonly continueButton: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInputField = page.getByRole('textbox', { name: 'Email address' });
        this.passwordInputField = page.getByRole('textbox', { name: 'Password' });
        this.continueButton = page.getByRole('button', { name: 'Continue' });
    }

    async typeOnEmailInput(email: string) {
        await this.type(this.emailInputField, email);
    }

    async typeOnPasswordInput(password: string) {
        await this.type(this.passwordInputField, password);
    }

    async clickOnContinueButton() {
        await this.click(this.continueButton);
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
    charityPortalLoginPage: async ({page}, use) => {
        const charityPortalLoginPage = new CharityPortalLoginPage(page);
        use(charityPortalLoginPage);
    },
    charityPortalDashboardPage: async ({page}, use) => {
        const charityPortalDashboardPage = new CharityPortalDashboardPage(page);
        use(charityPortalDashboardPage);
    },
    // ... more page objects
});
```

### Using Fixtures in Tests

Tests automatically receive fixtures through dependency injection:

```typescript
import { test, expect } from './../lib/page-object-fixtures';

test('CA-021 Add New User', async ({ 
    page, 
    charityPortalDashboardPage,
    charityPortalManageUsersPage, 
    waitForPageLoad,
    saveAttachments,
    saveBrowserVersion 
}) => {
    // All fixtures are automatically available
    await charityPortalDashboardPage.clickOnManageUsersLink();
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

- **Page Objects**: `{module}-{feature}-page.ts` (e.g., `charity-portal-login-page.ts`)
- **Test Files**: `{module}-{feature}.spec.ts` (e.g., `charity-user-management.spec.ts`)
- **Methods**: camelCase with descriptive names (e.g., `clickOnContinueButton()`)
- **Locators**: Descriptive names indicating element purpose (e.g., `emailInputField`)

## Related Documentation

- [Page Objects](04-page-objects.md) - Detailed page object creation guidelines
- [Test Development](03-test-development.md) - How to write tests using this architecture
- [Configuration](02-configuration.md) - Project configuration details

