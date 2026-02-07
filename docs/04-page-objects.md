# Page Objects

This document provides guidelines for creating and maintaining page objects in the project.

## Page Object Model Overview

Page Objects encapsulate page-specific elements and actions, providing a clean interface for tests. All page objects extend the `BasePage` class, which provides common functionality.

## Creating a Page Object

### File Structure

Page objects are located in the `page-objects/` directory and follow the naming convention: `{module}-{feature}-page.ts`.

Example: `charity-portal-login-page.ts`

### Basic Page Object Template

```typescript
import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

export class CharityPortalLoginPage extends BasePage {
    // Locator declarations
    readonly emailInputField: Locator;
    readonly passwordInputField: Locator;
    readonly continueButton: Locator;

    constructor(page: Page) {
        super(page);
        // Initialize locators
        this.emailInputField = page.getByRole('textbox', { name: 'Email address' });
        this.passwordInputField = page.getByRole('textbox', { name: 'Password' });
        this.continueButton = page.getByRole('button', { name: 'Continue' });
    }

    // Action methods
    async typeOnEmailInput(email: string) {
        await this.type(this.emailInputField, email);
    }

    async typeOnPasswordInput(password: string) {
        await this.type(this.passwordInputField, password);
    }

    async clickOnContinueButton() {
        await this.click(this.continueButton);
    }

    // Visibility check methods
    async isEmailInputVisible() {
        return await this.isElementVisible(this.emailInputField);
    }

    async isContinueButtonVisible() {
        return await this.isElementVisible(this.continueButton);
    }
}
```

## Locator Definition Patterns

### Locator Declaration

All locators should be declared as `readonly` properties:

```typescript
readonly emailInputField: Locator;
readonly passwordInputField: Locator;
readonly continueButton: Locator;
```

### Locator Initialization

Initialize locators in the constructor using Playwright's recommended locator methods:

```typescript
constructor(page: Page) {
    super(page);
    
    // Preferred: getByRole
    this.emailInputField = page.getByRole('textbox', { name: 'Email address' });
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    
    // Alternative: getByText
    this.welcomeMessage = page.getByText('Welcome back!');
    
    // Alternative: getByLabel
    this.usernameField = page.getByLabel('Username');
    
    // Last resort: locator with CSS selector
    this.einInputField = page.locator('input[data-headlessui-state]');
}
```

### Locator Naming Conventions

- Use descriptive names that indicate the element's purpose
- Use camelCase
- Include element type in name when helpful (e.g., `emailInputField`, `continueButton`)

Examples:
- `emailInputField` - Input field for email
- `continueButton` - Button to continue
- `manageUsersLink` - Link to manage users
- `errorMessageText` - Text element showing error message

## Method Naming Conventions

### Action Methods

Action methods should use verb prefixes:

- `clickOn...()` - Click actions
- `typeIn...()` or `typeOn...()` - Input actions
- `select...()` - Selection actions
- `navigateTo...()` - Navigation actions
- `waitFor...()` - Wait actions

Examples:
```typescript
async clickOnContinueButton() { ... }
async typeOnEmailInput(email: string) { ... }
async selectOptionFromDropdown(option: string) { ... }
async waitForURLContains(substring: string) { ... }
```

### Visibility Check Methods

Visibility check methods should use `is...Visible()` or `is...NotVisible()`:

```typescript
async isEmailInputVisible(): Promise<boolean> {
    return await this.isElementVisible(this.emailInputField);
}

async isErrorMessageNotVisible(): Promise<boolean> {
    return await this.isElementNotVisible(this.errorMessageText);
}
```

### Getter Methods

Getter methods should use `get...()` prefix:

```typescript
async getEmailInputValue(): Promise<string | null> {
    return await this.getAttribute(this.emailInputField, 'value');
}

async getWelcomeMessageText(): Promise<string> {
    return await this.getText(this.welcomeMessage);
}
```

## BasePage Methods Reference

All page objects inherit from `BasePage`, which provides the following methods:

### Element Interaction Methods

#### `click(locator: Locator, waitForPageLoad = false): Promise<void>`

Click on an element. Optionally wait for page load after click.

```typescript
await this.click(this.continueButton);
await this.click(this.submitButton, true);  // Wait for page load
```

#### `type(locator: Locator, text: string, waitForPageLoad = false): Promise<void>`

Type text into an element. Optionally wait for page load after typing.

```typescript
await this.type(this.emailInputField, 'user@example.com');
await this.type(this.searchField, 'query', true);  // Wait for page load
```

#### `selectOption(locator: Locator, value: string): Promise<void>`

Select an option from a dropdown.

```typescript
await this.selectOption(this.roleDropdown, 'admin');
```

#### `hover(locator: Locator): Promise<void>`

Hover over an element.

```typescript
await this.hover(this.menuItem);
```

#### `pressKey(locator: Locator, key: string): Promise<void>`

Press a key on an element.

```typescript
await this.pressKey(this.inputField, 'Enter');
```

#### `uploadFile(locator: Locator, filePath: string): Promise<void>`

Upload a file.

```typescript
await this.uploadFile(this.fileInput, './test-data/image.png');
```

### Element State Methods

#### `isElementVisible(locator: Locator, timeout?: number): Promise<boolean>`

Check if an element is visible.

```typescript
const isVisible = await this.isElementVisible(this.submitButton);
```

#### `isElementNotVisible(locator: Locator, timeout?: number): Promise<boolean>`

Check if an element is not visible.

```typescript
const isHidden = await this.isElementNotVisible(this.loadingSpinner);
```

#### `isElementEnabled(locator: Locator, timeout?: number): Promise<boolean>`

Check if an element is enabled.

```typescript
const isEnabled = await this.isElementEnabled(this.submitButton);
```

### Wait Methods

#### `waitForElementToBeVisible(locator: Locator, timeout?: number): Promise<void>`

Wait for an element to become visible.

```typescript
await this.waitForElementToBeVisible(this.successMessage);
```

#### `waitForElementToBeHidden(locator: Locator, timeout?: number): Promise<void>`

Wait for an element to become hidden.

```typescript
await this.waitForElementToBeHidden(this.loadingSpinner);
```

#### `waitForURLContains(substring: string, timeout?: number): Promise<void>`

Wait for the URL to contain a specific substring.

```typescript
await this.waitForURLContains('/dashboard');
```

#### `waitForSelectorWithRetry(selector: string, timeout?: number): Promise<Locator>`

Wait for a selector with retries if needed.

```typescript
const locator = await this.waitForSelectorWithRetry('.dynamic-content');
```

### Data Retrieval Methods

#### `getText(locator: Locator): Promise<string>`

Get the inner text of an element.

```typescript
const text = await this.getText(this.welcomeMessage);
```

#### `getAttribute(locator: Locator, attribute: string): Promise<string | null>`

Get an attribute value from an element.

```typescript
const value = await this.getAttribute(this.emailInput, 'value');
const href = await this.getAttribute(this.link, 'href');
```

### Assertion Methods

#### `assertElementText(locator: Locator, expectedText: string): Promise<void>`

Assert that an element's text equals the expected text.

```typescript
await this.assertElementText(this.statusMessage, 'Success');
```

### Frame Methods

#### `getFrameLocator(selector: string): FrameLocator`

Get a frame locator for iframe interactions.

```typescript
const frame = this.getFrameLocator('iframe[name="content"]');
await frame.getByRole('button', { name: 'Submit' }).click();
```

## Complete Page Object Example

Here's a complete example from the project:

```typescript
import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

export class CharityPortalLoginPage extends BasePage {
    readonly logInLink: Locator;
    readonly einInputField: Locator;
    readonly emailInputField: Locator;
    readonly passwordInputField: Locator;
    readonly continueButton: Locator;
    readonly forgotPasswordLink: Locator;

    constructor(page: Page) {
        super(page);
        this.logInLink = page.getByRole('link', { name: 'Log In' });
        this.einInputField = page.locator('input[data-headlessui-state]');
        this.emailInputField = page.getByRole('textbox', { name: 'Email address' });
        this.passwordInputField = page.getByRole('textbox', { name: 'Password' });
        this.continueButton = page.getByRole('button', { name: 'Continue' });
        this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
    }

    // Action methods
    async clickOnLogInLink() {
        await this.logInLink.click();
    }

    async typeOnEINInputField(ein: string) {
        await this.einInputField.fill(ein);
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

    async clickOnForgotPasswordLink() {
        await this.forgotPasswordLink.click();
    }

    // Visibility check methods
    async isEmailInputVisible() {
        return await this.isElementVisible(this.emailInputField);
    }

    async isPasswordInputVisible() {
        return await this.isElementVisible(this.passwordInputField);
    }

    async isContinueButtonVisible() {
        return await this.isElementVisible(this.continueButton);
    }

    async isForgotPasswordLinkVisible() {
        return await this.isElementVisible(this.forgotPasswordLink);
    }
}
```

## Best Practices

### 1. Keep Methods Focused

Each method should do one thing:

```typescript
// ✅ GOOD - Single responsibility
async typeOnEmailInput(email: string) {
    await this.type(this.emailInputField, email);
}

// ❌ BAD - Multiple responsibilities
async login(email: string, password: string) {
    await this.type(this.emailInputField, email);
    await this.type(this.passwordInputField, password);
    await this.click(this.continueButton);
}
```

### 2. Use BasePage Methods

Always use BasePage methods instead of direct Playwright calls:

```typescript
// ✅ GOOD - Use BasePage method
await this.type(this.emailInputField, email);

// ❌ BAD - Direct Playwright call
await this.emailInputField.fill(email);
```

### 3. Provide Visibility Checks

Include visibility check methods for important elements:

```typescript
async isManageUsersHeadingVisible() {
    return await this.isElementVisible(this.manageUsersHeading);
}
```

### 4. Handle Dynamic Elements

For dynamic elements, use filters and chaining:

```typescript
// Get first element matching criteria
readonly firstUserRow: Locator;

constructor(page: Page) {
    super(page);
    this.firstUserRow = page.getByRole('row').first();
}

// Get element by text content
async clickUserByName(name: string) {
    const userRow = this.page.getByRole('row').filter({ hasText: name });
    await this.click(userRow);
}
```

### 5. Use Readonly for Locators

Always declare locators as `readonly` to prevent accidental reassignment:

```typescript
readonly emailInputField: Locator;  // ✅ GOOD
let emailInputField: Locator;       // ❌ BAD
```

## Adding Page Objects to Fixtures

After creating a page object, add it to the fixtures in [`lib/page-object-fixtures.ts`](../lib/page-object-fixtures.ts):

```typescript
import { CharityPortalNewPage } from "../page-objects/charity-portal-new-page";

type pageObjectFixture = {
    // ... existing fixtures
    charityPortalNewPage: CharityPortalNewPage;
}

export const test = helperFixture.extend<pageObjectFixture>({
    // ... existing fixtures
    charityPortalNewPage: async ({page}, use) => {
        const charityPortalNewPage = new CharityPortalNewPage(page);
        use(charityPortalNewPage);
    }
});
```

## Related Documentation

- [Architecture Overview](01-architecture-overview.md) - Understanding the project structure
- [Test Development](03-test-development.md) - Using page objects in tests
- [Configuration](02-configuration.md) - Configuration details


















