# Configuration

This document explains all configuration files and settings used in the project.

## Playwright Configuration

The main Playwright configuration is defined in [`playwright.config.ts`](../playwright.config.ts). This file contains all the settings for running tests locally and in CI environments.

### Key Configuration Settings

#### Base URL

```typescript
use: {
    baseURL: 'https://staging-portal.givingafoundation.app/',
    // ...
}
```

The base URL is used for all `page.goto()` calls. When navigating, you can use relative paths:

```typescript
await page.goto('/');  // Navigates to baseURL + '/'
await page.goto('/dashboard');  // Navigates to baseURL + '/dashboard'
```

#### Timeouts

The project uses generous timeouts to handle slow network conditions:

```typescript
// Each test is given 5 minutes maximum time
timeout: 1000 * 60 * 5,

// Action timeout waiting for element to be clickable
actionTimeout: 1000 * 60,

// Navigation timeout between pages
navigationTimeout: 1000 * 60,

// Expect timeout
expect: {
    timeout: 1000 * 60,
}
```

#### Viewport and Browser Settings

```typescript
viewport: { width: 1280, height: 720 },
headless: true,
launchOptions: {
    slowMo: 100  // Slows down operations by 100ms
}
```

#### Browser Projects

The project is configured to run tests on multiple browsers:

```typescript
projects: [
    {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
    },
    {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
    },
    {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
    },
    {
        name: 'msedge',
        use: { ...devices['Desktop Edge'] },
    },
]
```

#### Test ID Attribute

The project uses a custom test ID attribute for element identification:

```typescript
testIdAttribute: "jhi",
```

This allows you to use `page.getByTestId()` with elements that have the `jhi` attribute.

#### Timezone

Timezone is set to ensure consistent behavior across environments:

```typescript
timezoneId: "America/New_York",
```

This is important for time-sensitive functionalities to prevent issues caused by timezone discrepancies.

#### Trace and Video

```typescript
// Collect trace when retrying the failed test
trace: 'on-first-retry',

// Capture screenshot after each test failure
screenshot: 'only-on-failure',

// Record video only when test is failed
video: 'retain-on-failure',
```

### Reporter Configuration

The project uses multiple reporters:

```typescript
reporter: [
    ['list'],           // Console output
    ['html'],           // HTML report
    [
        'allure-playwright',
        {
            detail: false,
            resultsDir: 'allure-results',
            categories: [
                {
                    name: "Failed Tests",
                    matchedStatuses: [Status.FAILED, Status.BROKEN],
                },
                {
                    name: "Running Tests",
                    matchedStatuses: [Status.PASSED],
                },
                {
                    name: "Skipped Tests",
                    matchedStatuses: [Status.SKIPPED],
                },
            ],
            environmentInfo: {
                os_platform: os.platform(),
                os_release: os.release(),
                os_version: os.version(),
                node_version: process.version,
            },
        },
    ],
]
```

**Important**: Allure Results generation provides rich HTML reports with history and trends. Don't disable Allure Results unless necessary.

### Global Setup

The project includes a global setup file that runs before all tests:

```typescript
globalSetup: './global-setup',
```

The [`global-setup.ts`](../global-setup.ts) file copies Allure history from previous reports to maintain trend data.

## Service Configuration

For Azure Playwright Service integration, there's a separate configuration file: [`playwright.service.config.ts`](../playwright.service.config.ts).

### Service-Specific Settings

```typescript
// Workers configuration
workers: 1,

// Service endpoint connection
connectOptions: {
    wsEndpoint: `${process.env.PLAYWRIGHT_SERVICE_URL}?cap=${JSON.stringify({
        os,
        runId: process.env.PLAYWRIGHT_SERVICE_RUN_ID,
    })}`,
    timeout: 120000,
    headers: {
        "x-mpt-access-key": process.env.PLAYWRIGHT_SERVICE_ACCESS_TOKEN!,
    },
    exposeNetwork: "<loopback>",
}
```

### Required Environment Variables for Service

```bash
PLAYWRIGHT_SERVICE_ACCESS_TOKEN=XXX
PLAYWRIGHT_SERVICE_URL=XXX
PLAYWRIGHT_SERVICE_RUN_ID=XXX  # Optional, auto-generated if not provided
```

## Environment Variables

The project uses environment variables for sensitive data and configuration. These are loaded from a `.env` file using `dotenv`.

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Test Management Platform Configuration (Optional)
# If using a test management platform, add your configuration here
# TEST_MANAGEMENT_API_TOKEN=your-api-token
# TEST_MANAGEMENT_PROJECT_ID=your-project-id

# Application Credentials
CHARITY_PORTAL_USERNAME=your_username
CHARITY_PORTAL_PASSWORD=your_password
CHARITY_FUNDED_USERNAME=funded_user_username
CHARITY_FUNDED_PASSWORD=funded_user_password
CHARITY_VIEWER_USERNAME=viewer_username
CHARITY_VIEWER_PASSWORD=viewer_password
CHARITY_EMPTY_USERNAME=empty_user_username
CHARITY_EMPTY_PASSWORD=empty_user_password
```

### Loading Environment Variables

Environment variables are loaded in the configuration files:

```typescript
import dotenv from 'dotenv'
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
```

### Using Environment Variables in Tests

```typescript
await charityPortalLoginPage.typeOnEmailInput(process.env.CHARITY_PORTAL_USERNAME!);
await charityPortalLoginPage.typeOnPasswordInput(process.env.CHARITY_PORTAL_PASSWORD!);
```

**Note**: The `!` operator tells TypeScript that the value is not null/undefined. Make sure your `.env` file is properly configured.

## Testlio CLI Configuration

The project uses Testlio CLI for result upload and management. Configuration files are located in the `testlio-cli/` directory.

### Project Configuration

[`testlio-cli/project-config.json`](../testlio-cli/project-config.json):

```json
{
    "baseURI": "https://api.testlio.com",
    "platformURI": "https://app.testlio.com/tmt/project/",
    "projectId": "3814",
    "testRunCollectionGuid": "2030d52d-0254-4f61-b947-399c13b43ea7",
    "automatedRunCollectionGuid": "2f93564d-3291-45ef-890c-33815259e027",
    "resultCollectionGuid": "5cb6cfaf-9758-4543-bbba-4ee6f324e7d8",
    "workspaceName": "givinga-charity-portal"
}
```

### Test Configuration

[`testlio-cli/test-config.json`](../testlio-cli/test-config.json):

```json
{
    "automatedTestNamePrefix": "Givinga Charity Portal Automated CI Run: "
}
```

### Testlio CLI Commands

The project uses Testlio CLI commands in the CI/CD pipeline:

```bash
# Example: Upload results to your test management platform
# Replace with your platform's CLI commands
# npx your-platform-cli upload-results --path allure-results/
```

## CI/CD Configuration

For CI/CD environment variables, see the [CI/CD Integration documentation](05-ci-cd-integration.md).

## Configuration Best Practices

1. **Never commit `.env` files**: Add `.env` to `.gitignore`
2. **Use secrets in CI/CD**: Store sensitive values as GitHub Secrets
3. **Document required variables**: Keep this documentation updated when adding new variables
4. **Use environment-specific configs**: Consider separate configs for different environments
5. **Validate configuration**: Ensure all required variables are set before running tests

## Related Documentation

- [CI/CD Integration](05-ci-cd-integration.md) - CI/CD configuration details
- [Project Setup](08-project-setup.md) - Initial setup and configuration
- [Architecture Overview](01-architecture-overview.md) - Project structure


















