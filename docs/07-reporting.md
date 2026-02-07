# Reporting

This document explains how test reporting works in the project, including Allure reports, Testlio integration, and artifact collection.

## Allure Reports

The project uses Allure for comprehensive test reporting. Allure provides rich HTML reports with test history, trends, and detailed test execution information.

### Generating Allure Reports

#### Generate Report

After running tests, generate the Allure report:

```bash
npm run allure:generate
```

This command:
- Reads test results from `allure-results/` directory
- Generates HTML report in `allure-report/` directory
- Preserves history from previous runs for trend analysis
- Cleans previous report before generating new one

#### View Report Locally

Open the generated report in your browser:

```bash
npm run allure:open
```

This command:
- Starts a local server
- Opens the report in your default browser
- Provides interactive report viewing

### Allure Report Structure

The Allure report includes:

#### 1. Overview

- Test execution summary
- Test results breakdown (passed, failed, skipped)
- Duration statistics
- Environment information

#### 2. Test Suites

Tests organized by:
- **Parent Suite** - High-level grouping (e.g., "User Management")
- **Suite** - Feature grouping (e.g., "User Management")
- **Sub-Suite** - Test type (e.g., "Regression", "Smoke")

#### 3. Test Cases

Each test case shows:
- Test name and metadata
- Execution status
- Duration
- Steps with screenshots
- Attachments (screenshots, videos, logs)
- Error messages and stack traces

#### 4. History and Trends

- Test execution history
- Trend charts for:
  - Duration trends
  - Retry trends
  - Categories trends
  - History trends

#### 5. Categories

Tests categorized by status:
- **Failed Tests** - Tests that failed or were broken
- **Running Tests** - Tests that passed
- **Skipped Tests** - Tests that were skipped

### Allure Configuration

Allure is configured in [`playwright.config.ts`](../playwright.config.ts):

```typescript
reporter: [
    ['list'],
    ['html'],
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

**Important**: Allure Results generation is required for displaying results on the Testlio platform. Don't disable Allure Results unless necessary.

### Allure Test Metadata

Tests can include metadata for better organization:

```typescript
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
```

See [Utilities and Helpers](06-utilities-and-helpers.md) for details.

### Allure Steps

Break tests into steps for better reporting:

```typescript
await allure.step('1. Navigate to Manage Users page', async () => {
    await charityPortalDashboardPage.clickOnManageUsersLink();
    await waitForPageLoad();
});

await allure.step('2. Click on Add User button', async () => {
    await charityPortalManageUsersPage.clickOnAddUserButton();
    await waitForPageLoad();
});
```

Each step appears in the Allure report with its own status and duration.

## Testlio Platform Integration

The project integrates with Testlio platform for test result management and reporting.

### Testlio Result Upload

Results are uploaded to Testlio through the CI/CD pipeline:

1. **Create Run** - Creates a test run in Testlio
2. **Execute Tests** - Runs tests and generates Allure results
3. **Parse Results** - Parses and uploads results per browser
4. **Finalize** - Finalizes the run, making results available

See [CI/CD Integration](05-ci-cd-integration.md) for details.

### Testlio Manual Test ID

Link automated tests to manual test cases:

```typescript
allure.label('testlioManualTestID', 'b6035023-45cd-4be0-bd35-f1a80ff310d5');
```

This creates a link between automated and manual tests in Testlio.

### Viewing Results in Testlio

1. Navigate to your Testlio project
2. Go to the test run
3. View results organized by browser
4. See detailed test execution information
5. Access screenshots, videos, and logs

## Screenshot Capture

### Automatic Screenshots

Screenshots are automatically captured on test failure:

```typescript
// Configured in playwright.config.ts
screenshot: 'only-on-failure',
```

Screenshots are saved to:
- `test-results/` directory
- Allure report attachments
- Testlio platform (when uploaded)

### Manual Screenshot Attachment

Attach screenshots manually using AllureHelper:

```typescript
import AllureHelper from '../lib/allure-helper';

await AllureHelper.attachScreenShot(page);
```

### Screenshot Locations

- **Local**: `test-results/{test-name}/screenshot.png`
- **Allure**: Attached to test in report
- **Testlio**: Available in test run details

## Video Capture

### Automatic Video Recording

Videos are recorded for failed tests:

```typescript
// Configured in playwright.config.ts
video: 'retain-on-failure',
```

Videos are saved to:
- `test-results/` directory
- Allure report attachments (if configured)
- Testlio platform (when uploaded)

### Video Locations

- **Local**: `test-results/{test-name}/video.webm`
- **Allure**: Attached to test in report (if configured)
- **Testlio**: Available in test run details

## Trace Files

Traces are collected when tests are retried:

```typescript
// Configured in playwright.config.ts
trace: 'on-first-retry',
```

Traces can be viewed using Playwright Trace Viewer:

```bash
npx playwright show-trace test-results/{test-name}/trace.zip
```

## Artifact Collection

### Test Failure Artifacts

The test failure capture utility automatically captures artifacts on test failure:

- **Screenshot** - Full-page screenshot
- **Page Source** - HTML source code
- **Error Message** - Detailed error with stack trace
- **Current URL** - Page URL at failure

See [Utilities and Helpers](06-utilities-and-helpers.md) for details.

### Console Logs

Console logs are automatically captured on test failure:

```typescript
// Configured in helpers-fixtures.ts
saveAttachments: [async ({ page }, use, testInfo) => {
    const logs: Array<String> = [];
    page.on('console', (msg) => {
        logs.push(`${msg.type()}: ${msg.text()}`);
    });
    // ... saves logs on failure
}, { auto: true }]
```

### Browser Version

Browser version is automatically saved:

```typescript
// Configured in helpers-fixtures.ts
saveBrowserVersion: [async ({ browser, browserName }, use, testInfo) => {
    // ... saves browser version
}, { auto: true }]
```

## Playwright HTML Report

In addition to Allure, Playwright generates its own HTML report:

### Generate Report

The report is automatically generated after test execution and saved to `playwright-report/` directory.

### View Report

Open `playwright-report/index.html` in your browser, or use:

```bash
npx playwright show-report
```

### Report Features

- Test execution timeline
- Test results overview
- Screenshots and videos
- Console logs
- Network requests
- Test traces

## Report Interpretation

### Understanding Test Status

- **PASSED** - Test executed successfully
- **FAILED** - Test failed during execution
- **SKIPPED** - Test was skipped (e.g., using `test.skip()`)
- **BROKEN** - Test encountered an error

### Analyzing Failures

When a test fails, check:

1. **Screenshot** - Visual state at failure
2. **Error Message** - What went wrong
3. **Stack Trace** - Where the error occurred
4. **Console Logs** - Browser console output
5. **Network Requests** - API calls and responses
6. **Test Steps** - Which step failed

### Trend Analysis

Use Allure history to track:

- **Duration Trends** - Are tests getting slower?
- **Retry Trends** - Are tests flaky?
- **Category Trends** - Which test categories are failing?
- **History Trends** - Overall test health over time

## Best Practices

### 1. Use Allure Steps

Break tests into logical steps:

```typescript
await allure.step('1. Navigate to page', async () => {
    // ...
});
```

### 2. Attach Screenshots Strategically

Attach screenshots at key verification points:

```typescript
await AllureHelper.attachScreenShot(page);
```

### 3. Include Test Metadata

Always include metadata for better organization:

```typescript
await AllureHelper.applyTestMetadata({
    // ...
});
```

### 4. Link to Manual Tests

Link automated tests to manual test cases:

```typescript
allure.label('testlioManualTestID', 'test-id');
```

### 5. Review Reports Regularly

- Check Allure reports after each run
- Review trends for flaky tests
- Analyze failure patterns

## Related Documentation

- [Utilities and Helpers](06-utilities-and-helpers.md) - AllureHelper usage
- [CI/CD Integration](05-ci-cd-integration.md) - Result upload process
- [Configuration](02-configuration.md) - Reporter configuration


















