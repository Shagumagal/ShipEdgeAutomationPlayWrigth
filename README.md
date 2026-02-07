# Playwright TypeScript Template Project

A comprehensive, production-ready Playwright automation framework template built with TypeScript. This template demonstrates best practices for end-to-end testing including Page Object Model, Allure reporting, and CI/CD integration.

## 🚀 Quick Start

### Prerequisites

- **Node.js** (LTS version recommended - v18 or higher)
- **npm** or **yarn**
- **Git**

### Installation

1. **Clone or download this template:**
   ```bash
   git clone <repository-url>
   cd playwright-template-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   
   **Basic (Chrome only):**
   ```bash
   npx playwright install chromium --with-deps
   ```
   
   **Recommended (All browsers for parallel execution):**
   ```bash
   npx playwright install chromium msedge firefox webkit --with-deps
   ```
   
   See [Multi-Browser Setup](#-multi-browser-setup-for-parallel-execution) section below for details.

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file and update with your application's configuration:
   - `BASE_URL` - Your application URL
   - `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` - Test credentials
   - `TEST_ID_ATTRIBUTE` - Your app's test ID attribute (if used)
   - Other variables as needed

5. **Update Playwright configuration:**
   - Open `playwright.config.ts`
   - Update `baseURL` to match your application
   - Adjust `testIdAttribute` if your app uses different test IDs
   - Update `timezoneId` if needed

## 📁 Project Structure

```
testlio-playwright-charity/
├── lib/                    # Core utilities and base classes
│   ├── basepage.ts        # BasePage class with common methods
│   ├── allure-helper.ts   # Allure reporting utilities
│   ├── helpers-fixtures.ts # Playwright fixtures
│   ├── page-object-fixtures.ts # Page Object fixtures
│   ├── helper-functions.ts # Utility functions
│   ├── logger.ts          # Logging utility
│   └── test-failure-capture.ts    # Test failure artifact capture utility
├── page-objects/          # Page Object Model classes
│   ├── example-login-page.ts
│   └── example-dashboard-page.ts
├── tests/                 # Test specifications
│   ├── example-login.spec.ts
│   └── example-dashboard.spec.ts
├── data/                  # Test data and constants
│   └── example-data.json
├── docs/                  # Technical documentation
├── playwright.config.ts   # Main Playwright configuration
├── playwright.service.config.ts # Playwright Service config
├── tsconfig.json         # TypeScript compiler configuration
├── eslint.config.mjs     # ESLint configuration
├── package.json          # Dependencies and scripts
└── .env.example          # Environment variables template
```

## 🧪 Running Tests

### Run tests on specific browsers:

```bash
# Chrome
npm run test:smoke-chrome

# Edge
npm run test:smoke-edge

# Firefox
npm run test:smoke-firefox

# Safari/WebKit
npm run test:smoke-safari
```

### Run all tests (regression):

```bash
npm run test:regression
```

### Run a specific test file:

```bash
npx playwright test tests/example-login.spec.ts
```

### Run tests in headed mode (see browser):

```bash
npx playwright test --headed
```

### Run tests with UI mode:

```bash
npx playwright test --ui
```

### Run tests in parallel across all browsers:

```bash
# Run all tests on all configured browsers simultaneously
npx playwright test

# Or specify number of workers
npx playwright test --workers=4
```

## 🌐 Multi-Browser Setup for Parallel Execution

The framework is configured to support multiple browsers (Chrome, Edge, Firefox, Safari) for parallel test execution. To enable this:

### Install All Browsers

```bash
# Install all browsers with system dependencies
npx playwright install chromium msedge firefox webkit --with-deps
```

### Benefits of Multi-Browser Setup

1. **Parallel Execution**: Tests run simultaneously across different browsers, significantly reducing execution time
2. **Cross-Browser Coverage**: Verify your application works correctly across all major browser engines
3. **Browser-Specific Testing**: Run tests on specific browsers when needed

### Running Tests Across Browsers

Once all browsers are installed, you can:

**Run all tests on all browsers in parallel:**
```bash
npx playwright test
```

**Run specific browser projects:**
```bash
# Chrome only
npx playwright test --project=chromium

# Edge only
npx playwright test --project=msedge

# Firefox only
npx playwright test --project=firefox

# Safari/WebKit only
npx playwright test --project=webkit
```

**Configure parallel workers:**
```bash
# Run with 4 parallel workers (adjust based on your machine)
npx playwright test --workers=4

# Or update playwright.config.ts
workers: 4
```

### Browser Installation Commands Reference

```bash
# Install all browsers (recommended)
npx playwright install chromium msedge firefox webkit --with-deps

# Install individual browsers
npx playwright install chromium --with-deps
npx playwright install msedge --with-deps
npx playwright install firefox --with-deps
npx playwright install webkit --with-deps

# Install without system dependencies (if dependencies already installed)
npx playwright install chromium msedge firefox webkit
```

**Note**: The `--with-deps` flag installs system dependencies required for browsers. On Linux, this may require sudo permissions.

## 📊 Generating Reports

### Allure Report

1. **Generate the report:**
   ```bash
   npm run allure:generate
   ```

2. **Open the report:**
   ```bash
   npm run allure:open
   ```

### Playwright HTML Report

The Playwright HTML report is automatically generated after test execution. Open it with:

```bash
npx playwright show-report
```

## 🏗️ Architecture & Patterns

### Page Object Model (POM)

This template follows the Page Object Model pattern:

- **Page Objects** (`page-objects/`) - Encapsulate page-specific logic and locators
- **BasePage** - Provides common functionality for all page objects
- **Tests** (`tests/`) - Contain only high-level test steps using page methods

**Example Page Object:**
```typescript
export class ExampleLoginPage extends BasePage {
    readonly emailInput: Locator;
    
    constructor(page: Page) {
        super(page);
        this.emailInput = page.getByRole('textbox', { name: /email/i });
    }
    
    async enterEmail(email: string) {
        await this.type(this.emailInput, email);
    }
}
```

### Fixtures Pattern

Page Objects are injected into tests via fixtures:

```typescript
test('Login test', async ({ exampleLoginPage }) => {
    await exampleLoginPage.enterEmail('test@example.com');
});
```

### Allure Reporting

Tests use Allure metadata for rich reporting:

```typescript
await AllureHelper.applyTestMetadata({
    displayName: "Test Name",
    tags: ["smoke", "critical"],
    severity: "critical",
    epic: "Feature",
    feature: "Sub-feature",
    story: "User Story"
});
```

## 📝 Writing Your First Test

1. **Create a Page Object** (`page-objects/my-page.ts`):
   ```typescript
   import BasePage from "../lib/basepage";
   
   export class MyPage extends BasePage {
       readonly myButton: Locator;
       
       constructor(page: Page) {
           super(page);
           this.myButton = page.getByRole('button', { name: 'Click Me' });
       }
       
       async clickMyButton() {
           await this.click(this.myButton);
       }
   }
   ```

2. **Add Page Object to fixtures** (`lib/page-object-fixtures.ts`):
   ```typescript
   myPage: async ({ page }, use) => {
       const myPage = new MyPage(page);
       use(myPage);
   }
   ```

3. **Write your test** (`tests/my-test.spec.ts`):
   ```typescript
   import { test, expect } from '../lib/page-object-fixtures';
   
   test('My test', async ({ myPage }) => {
       await myPage.clickMyButton();
       // Add assertions
   });
   ```

## 🔧 Configuration

### Playwright Configuration

Key settings in `playwright.config.ts`:

- **baseURL** - Your application URL
- **testIdAttribute** - Custom test ID attribute
- **timeout** - Test timeout (default: 5 minutes)
- **retries** - Number of retries on failure
- **workers** - Parallel test execution
- **projects** - Browser configurations

### Environment Variables

See `.env.example` for all available environment variables. Key ones:

- `BASE_URL` - Application URL
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` - Test credentials
- `TEST_ID_ATTRIBUTE` - Test ID attribute name
- `TIMEZONE` - Timezone setting

## 🚀 CI/CD Integration

### GitHub Actions

The template includes a GitHub Actions workflow (`.github/workflows/github-actions-run.yml`) that:

- Runs tests on Chrome browser
- Generates Allure reports
- Uploads Allure results as artifacts
- Supports manual triggers and scheduled runs (optional)

#### Scheduled Test Execution

The workflow includes a commented-out schedule section that you can enable for automated test runs. To enable scheduled execution:

1. Open `.github/workflows/github-actions-run.yml`
2. Uncomment the `schedule` section
3. Adjust the cron expression to your desired schedule

**Cron Syntax:** `"minute hour day-of-month month day-of-week"`

**Examples:**
- `"0 3 * * *"` - Every day at 3:00 AM UTC
- `"0 */6 * * *"` - Every 6 hours
- `"0 9 * * 1-5"` - Every weekday (Monday-Friday) at 9:00 AM UTC
- `"0 0 1 * *"` - First day of every month at midnight UTC
- `"30 14 * * 0"` - Every Sunday at 2:30 PM UTC

**Note:** GitHub Actions uses UTC timezone. Adjust accordingly for your timezone.


## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- [Architecture Overview](docs/01-architecture-overview.md)
- [Configuration](docs/02-configuration.md)
- [Test Development](docs/03-test-development.md)
- [Page Objects](docs/04-page-objects.md)
- [CI/CD Integration](docs/05-ci-cd-integration.md)
- [Utilities and Helpers](docs/06-utilities-and-helpers.md)
- [Reporting](docs/07-reporting.md)
- [Project Setup](docs/08-project-setup.md)
- [Troubleshooting](docs/11-troubleshooting.md)
- [Multi-Browser Setup](docs/12-multi-browser-setup.md)

## 🛠️ Available Scripts

- `npm run test:smoke-chrome` - Run smoke tests on Chrome
- `npm run test:smoke-edge` - Run smoke tests on Edge
- `npm run test:smoke-firefox` - Run smoke tests on Firefox
- `npm run test:smoke-safari` - Run smoke tests on Safari/WebKit
- `npm run test:regression` - Run all regression tests
- `npm run allure:generate` - Generate Allure report
- `npm run allure:open` - Open Allure report
- `npm run lint:tests` - Lint test files

## ✨ Key Features

- ✅ **Page Object Model** - Maintainable and reusable test code
- ✅ **Multi-browser Testing** - Chrome, Edge, Firefox, and Safari
- ✅ **Allure Reporting** - Rich HTML reports with history and trends
- ✅ **TypeScript** - Type-safe test code
- ✅ **Fixtures Pattern** - Dependency injection for tests
- ✅ **Failure Artifact Capture** - Comprehensive test failure artifact collection
- ✅ **CI/CD Ready** - GitHub Actions workflow included
- ✅ **Comprehensive Documentation** - Detailed guides and examples

## 🎯 Best Practices Demonstrated

1. **Locator Strategy** - Uses Playwright's recommended locators (getByRole, getByText, etc.)
2. **Error Handling** - Comprehensive error capture with screenshots and artifacts
3. **Test Organization** - Clear test structure with Allure metadata
4. **Reusability** - BasePage class and helper functions
5. **Maintainability** - Page Object Model separation of concerns
6. **Reporting** - Rich Allure reports with steps and attachments

## 🤝 Customizing for Your Application

1. **Update Configuration:**
   - Set `BASE_URL` in `.env` and `playwright.config.ts`
   - Update `testIdAttribute` if your app uses test IDs
   - Adjust timeouts and retries as needed

2. **Create Your Page Objects:**
   - Follow the example page objects structure
   - Extend `BasePage` for common functionality
   - Use Playwright's recommended locator strategies

3. **Write Your Tests:**
   - Use fixtures to inject page objects
   - Add Allure metadata for reporting
   - Follow the example test structure

4. **Update Fixtures:**
   - Add your page objects to `page-object-fixtures.ts`
   - Create custom fixtures as needed

## 📄 License

ISC

## 🙏 Contributing

When adding new tests or features:

1. Follow the [Test Development guidelines](docs/03-test-development.md)
2. Create page objects following [Page Objects documentation](docs/04-page-objects.md)
3. Update documentation as needed
4. Ensure tests pass on all browsers

## 📞 Support

For issues, questions, or contributions:

- Review the [technical documentation](docs/README.md)
- Check existing issues in the repository
- Contact the QA Automation team

---

**Happy Testing! 🎉**
