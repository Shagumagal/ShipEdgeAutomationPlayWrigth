# Template Customization Guide

This guide will help you customize this Playwright template for your specific application.

## 🎯 Quick Customization Checklist

- [ ] Update `BASE_URL` in `.env` and `playwright.config.ts`
- [ ] Update `testIdAttribute` if your app uses test IDs
- [ ] Replace example page objects with your application's pages
- [ ] Update fixtures to include your page objects
- [ ] Replace example tests with your test scenarios
- [ ] Update test data in `data/example-data.json`
- [ ] Configure Testlio (if using Testlio platform)
- [ ] Update CI/CD workflow if needed

## 📝 Step-by-Step Customization

### 1. Configuration Setup

#### Update Base URL
**File:** `playwright.config.ts` and `.env`

```typescript
// In playwright.config.ts
baseURL: process.env.BASE_URL || 'https://your-app.com',

// In .env
BASE_URL=https://your-app.com
```

#### Update Test ID Attribute
If your application uses test IDs (recommended), update the attribute name:

**File:** `playwright.config.ts`

```typescript
testIdAttribute: process.env.TEST_ID_ATTRIBUTE || "data-testid",
```

Common values:
- `data-testid` (most common)
- `data-qa`
- `testid`
- `id` (if using IDs)

#### Update Timezone
**File:** `playwright.config.ts` and `.env`

```typescript
timezoneId: process.env.TIMEZONE || "America/New_York",
```

### 2. Create Your Page Objects

#### Step 1: Create a new Page Object file

**File:** `page-objects/my-feature-page.ts`

```typescript
import { Locator, Page } from "@playwright/test";
import BasePage from "../lib/basepage";

export class MyFeaturePage extends BasePage {
    // Define locators using Playwright's recommended strategies
    readonly myButton: Locator;
    readonly myInput: Locator;
    
    constructor(page: Page) {
        super(page);
        
        // Priority order for locators:
        // 1. getByRole (most recommended)
        // 2. getByText
        // 3. getByLabel
        // 4. getByPlaceholder
        // 5. getByTestId (if using test IDs)
        
        this.myButton = page.getByRole('button', { name: 'Submit' });
        this.myInput = page.getByRole('textbox', { name: 'Email' });
    }
    
    // Add methods for page interactions
    async clickMyButton() {
        await this.click(this.myButton);
    }
    
    async enterText(text: string) {
        await this.type(this.myInput, text);
    }
}
```

#### Step 2: Add Page Object to Fixtures

**File:** `lib/page-object-fixtures.ts`

```typescript
import { MyFeaturePage } from "../page-objects/my-feature-page";

type pageObjectFixture = {
    // ... existing fixtures
    myFeaturePage: MyFeaturePage;
}

export const test = helperFixture.extend<pageObjectFixture>({
    // ... existing fixtures
    myFeaturePage: async ({ page }, use) => {
        const myFeaturePage = new MyFeaturePage(page);
        use(myFeaturePage);
    },
});
```

### 3. Write Your Tests

**File:** `tests/my-feature.spec.ts`

```typescript
import { test, expect } from '../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
import { captureTestFailure } from "../lib/test-failure-capture";

test.describe('My Feature', () => {
    test.beforeEach(async ({ page, myFeaturePage }) => {
        await page.goto('/my-feature');
        await page.waitForLoadState('networkidle');
    });

    test('TC-001: My Test Case', async ({ page, myFeaturePage }) => {
        await AllureHelper.applyTestMetadata({
            displayName: "My Test Case",
            tags: ["smoke", "critical"],
            severity: "critical",
            epic: "My Epic",
            feature: "My Feature",
            story: "My Story"
        });

        await allure.step('1. Perform action', async () => {
            await myFeaturePage.enterText('test@example.com');
        });

        await allure.step('2. Verify result', async () => {
            // Add assertions
            expect(true).toBe(true);
        });
    });

    test.afterEach(async ({ page }, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
            const error = new Error(`Test failed with status: ${testInfo.status}`);
            await captureTestFailure(page, testInfo, error);
        }
    });
});
```

### 4. Locator Strategy Best Practices

**Priority Order (from most recommended to least):**

1. **getByRole** - Most accessible and stable
   ```typescript
   page.getByRole('button', { name: 'Submit' })
   page.getByRole('textbox', { name: 'Email' })
   ```

2. **getByText** - For text content
   ```typescript
   page.getByText('Welcome')
   page.getByText(/regex pattern/i)
   ```

3. **getByLabel** - For form labels
   ```typescript
   page.getByLabel('Email address')
   ```

4. **getByPlaceholder** - For input placeholders
   ```typescript
   page.getByPlaceholder('Enter email')
   ```

5. **getByTestId** - If using test IDs (most stable)
   ```typescript
   page.getByTestId('submit-button')
   ```

6. **locator** - Last resort (CSS/XPath)
   ```typescript
   page.locator('#my-id')
   page.locator('.my-class')
   ```

### 5. Update Test Data

**File:** `data/example-data.json`

Replace with your application's test data:

```json
{
    "users": {
        "validUser": {
            "email": "your-test-user@example.com",
            "password": "YourPassword123!"
        }
    },
    "formData": {
        "validEmail": "test@example.com"
    }
}
```

### 6. Environment Variables

**File:** `.env`

Update with your application's credentials and configuration:

```env
BASE_URL=https://your-app.com
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=YourPassword123!
TEST_ID_ATTRIBUTE=data-testid
TIMEZONE=America/New_York
```

### 7. Testlio Configuration (Optional)

If using Testlio platform:

**File:** `testlio-cli/project-config.json`

```json
{
    "baseURI": "https://api.testlio.com",
    "projectId": "your-project-id",
    "testRunCollectionGuid": "your-guid",
    "workspaceName": "your-workspace"
}
```

### 8. CI/CD Customization

**File:** `.github/workflows/github-actions-run.yml`

#### Basic Configuration:
- Update environment variables (BASE_URL, credentials)
- Adjust test execution commands if needed
- Configure artifact paths

#### Scheduled Test Execution (Optional):

To enable automated scheduled test runs, uncomment the `schedule` section in the workflow file:

```yaml
schedule:
  - cron: "0 3 * * *"  # Runs tests automatically every day at 3:00 AM UTC
```

**Cron Syntax:** `"minute hour day-of-month month day-of-week"`

**Examples:**
- `"0 3 * * *"` - Every day at 3:00 AM UTC
- `"0 */6 * * *"` - Every 6 hours
- `"0 9 * * 1-5"` - Every weekday at 9:00 AM UTC (Monday-Friday)
- `"0 0 1 * *"` - First day of every month at midnight UTC
- `"30 14 * * 0"` - Every Sunday at 2:30 PM UTC

**Note:** GitHub Actions uses UTC timezone. Adjust accordingly for your timezone.

See [CI/CD Integration documentation](docs/05-ci-cd-integration.md) for detailed cron syntax explanation and more examples.

## 🔍 Common Customization Scenarios

### Scenario 1: Different Authentication Method

If your app uses different authentication:

1. Update `ExampleLoginPage` with your login flow
2. Modify login methods in page object
3. Update test credentials in `.env`

### Scenario 2: API Testing

To add API testing:

1. Create API helper in `lib/api-helper.ts`
2. Use Playwright's `request` API
3. Create API test files in `tests/api/`

### Scenario 3: Visual Regression Testing

To add visual testing:

1. Install `@playwright/test` (already included)
2. Use `expect(page).toHaveScreenshot()`
3. Configure in `playwright.config.ts`

### Scenario 4: Mobile Testing

To add mobile device testing:

**File:** `playwright.config.ts`

```typescript
projects: [
    {
        name: 'Mobile Chrome',
        use: { ...devices['Pixel 5'] },
    },
    {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
    },
]
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Allure Reporting](https://allurereport.org/docs/playwright/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)

## ✅ Verification Checklist

After customization, verify:

- [ ] All tests run successfully
- [ ] Page objects follow BasePage pattern
- [ ] Tests use fixtures for page objects
- [ ] Allure reports generate correctly
- [ ] CI/CD pipeline works (if configured)
- [ ] Documentation is updated
- [ ] Environment variables are set
- [ ] Test data is appropriate

## 🆘 Troubleshooting

### Tests fail with "Element not found"
- Check locator strategy (use getByRole when possible)
- Verify element is visible before interaction
- Add appropriate waits

### Allure reports not generating
- Run `npm run allure:generate` after tests
- Check `allure-results/` directory exists
- Verify Allure is installed: `npm list allure-playwright`

### Fixtures not working
- Ensure page object is added to `page-object-fixtures.ts`
- Check import paths are correct
- Verify page object extends BasePage

---

**Need help?** Check the [documentation](docs/README.md) or review the example files in this template.
