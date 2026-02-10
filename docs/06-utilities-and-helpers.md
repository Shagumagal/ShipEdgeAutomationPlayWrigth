# Utilities and Helpers

This document describes the utility classes and helper functions available in the project.

## AllureHelper

The `AllureHelper` class provides utilities for managing Allure test reports and metadata. Located in [`lib/allure-helper.ts`](../lib/allure-helper.ts).

### Features

- Test metadata management
- Screenshot attachment
- Structured test organization

### Methods

#### `applyTestMetadata(options: TestMetadataOptions)`

Applies structured metadata to tests for better organization in Allure reports.

```typescript
import AllureHelper from '../lib/allure-helper';

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
```

**Metadata Options:**

- `displayName` - Custom test display name
- `owner` - Test owner/team
- `tags` - Array of tags for filtering
- `severity` - Test severity (blocker, critical, normal, minor, trivial)
- `epic` - Epic grouping
- `feature` - Feature grouping
- `story` - User story
- `parentSuite` - Parent test suite
- `suite` - Test suite
- `subSuite` - Sub-suite

#### `attachScreenShot(page: Page)`

Attaches a full-page screenshot to the Allure report.

```typescript
import AllureHelper from '../lib/allure-helper';

await AllureHelper.attachScreenShot(page);
```

**Usage Example:**

```typescript
test('TC-001: Successful Login with Valid Credentials', async ({ page, exampleLoginPage }) => {
    // ... test steps
    
    await allure.step('4. Verify successful login', async () => {
        expect(await exampleLoginPage.isSuccessMessageVisible()).toBe(true);
        await AllureHelper.attachScreenShot(page);  // Attach screenshot
    });
});
```

### Complete Example

```typescript
import { test, expect } from './../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';

test('TC-001: Successful Login with Valid Credentials', async ({ page, exampleLoginPage }) => {
    // Apply metadata
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
    
    // Test steps...
    
    // Attach screenshot at end
    await AllureHelper.attachScreenShot(page);
});
```

## Test Failure Artifact Capture Utility

The test failure capture utility automatically collects comprehensive artifacts when tests fail. Located in [`lib/test-failure-capture.ts`](../lib/test-failure-capture.ts).

### Purpose

This utility captures detailed information when tests fail to aid in debugging and analysis. It captures:
- Screenshots
- Page source code
- Error messages and stack traces
- Current URL

### Usage

Add the `afterEach` hook to capture failure artifacts:

```typescript
import { captureTestFailure } from "../lib/test-failure-capture";

test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const error = new Error(`Test failed with status: ${testInfo.status}`);
        await captureTestFailure(page, testInfo, error);
    }
});
```

### What Gets Captured

When a test fails, the following artifacts are automatically attached to the Allure report:

1. **Screenshot** - Full-page screenshot with naming: `failure_screenshot_{timestamp}_{testTitle}.png`
2. **Page Source** - HTML source code: `failure_src_code_{timestamp}_{testTitle}.html`
3. **Error Message** - Detailed error with stack trace: `failure_error_msg_{timestamp}_{testTitle}.txt`
4. **Current URL** - Page URL at failure: `failure_current_url_{timestamp}_{testTitle}.txt`

### Artifact Naming Convention

Artifacts are named with:
- Timestamp (time and date)
- Test title (sanitized)
- Type prefix (`failure_*`)

Example: `failure_screenshot_14_30_45_12_25_2024_TC_001_Successful_Login.png`

### Complete Example

```typescript
import { test, expect } from './../lib/page-object-fixtures';
import { captureTestFailure } from "../lib/test-failure-capture";

test('TC-001: Login Test', async ({ page, ... }) => {
    // Test implementation...
});

// Capture artifacts on failure
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        const error = new Error(`Test failed with status: ${testInfo.status}`);
        await captureTestFailure(page, testInfo, error);
    }
});
```

### Benefits

- **Automatic artifact capture** - No manual intervention needed
- **Better debugging** - All failure context captured automatically
- **Allure integration** - Artifacts automatically attached to reports
- **Comprehensive failure analysis** - Screenshots, source code, and error details in one place

## Helper Functions

Utility functions for common operations. Located in [`lib/helper-functions.ts`](../lib/helper-functions.ts).

### CSV Parsing Functions

#### `parseCsvLine(line: string): string[]`

Parses a single CSV line, handling quoted values correctly.

```typescript
import { parseCsvLine } from '../lib/helper-functions';

const line = 'Name,Email,"Address, City"';
const values = parseCsvLine(line);
// Returns: ['Name', 'Email', 'Address, City']
```

#### `parseCsvContent(content: string): string[][]`

Parses complete CSV content into a 2D array.

```typescript
import { parseCsvContent } from '../lib/helper-functions';

const csvContent = `Name,Email
John,john@example.com
Jane,jane@example.com`;

const rows = parseCsvContent(csvContent);
// Returns: [
//   ['Name', 'Email'],
//   ['John', 'john@example.com'],
//   ['Jane', 'jane@example.com']
// ]
```

#### `assertCsvColumns(content: string, expectedColumns: string[]): void`

Validates that a CSV file contains the expected columns.

```typescript
import { assertCsvColumns } from '../lib/helper-functions';

const csvContent = `Name,Email,Phone
John,john@example.com,123-456-7890`;

assertCsvColumns(csvContent, ['Name', 'Email', 'Phone']);
// Throws error if columns are missing
```

**Usage Example:**

```typescript
test('Verify CSV export', async ({ page }) => {
    // Download CSV file
    const csvContent = await downloadCsvFile();
    
    // Validate columns
    assertCsvColumns(csvContent, ['Name', 'Email', 'Phone', 'Status']);
    
    // Parse and verify data
    const rows = parseCsvContent(csvContent);
    expect(rows.length).toBeGreaterThan(0);
});
```

## Logger Utility

The logger utility provides structured logging using Winston. Located in [`lib/logger.ts`](../lib/logger.ts).

### Usage

```typescript
const logger = require('../lib/logger')(module);

logger.info('Test started');
logger.error('Test failed', error);
logger.warn('Warning message');
logger.debug('Debug information');
```

### Log Format

Logs are formatted with:
- Timestamp (YYYY-MM-DD HH:mm:ss)
- Log level
- Module/file name
- Message

Example output:
```
2026-02-07 12:28:16 [info] [tests/example-login.spec.ts]: Test started
```

### Log Levels

- `error` - Error messages
- `warn` - Warning messages
- `info` - Informational messages
- `debug` - Debug messages

## Fixtures

The project provides custom fixtures for common test utilities. See [Architecture Overview](01-architecture-overview.md) for details.

### Helper Fixtures

Located in [`lib/helpers-fixtures.ts`](../lib/helpers-fixtures.ts):

#### `waitForPageLoad`
Waits for page to fully load (load, DOMContentLoaded, and networkidle states).

```typescript
test('My test', async ({ page, waitForPageLoad }) => {
    await page.goto('/my-page');
    await waitForPageLoad();
});
```

#### `saveAttachments` (Auto Fixture)
**Auto fixture** that automatically captures console logs and screenshots when a test fails. Runs automatically after the test completes.

**What it does:**
- Collects all console messages during test execution
- On test failure: Saves console logs and screenshot to test artifacts
- Attaches artifacts to both Allure report and Playwright test info

**Usage:**
```typescript
test('My test', async ({ page, saveAttachments }) => {
    // Test code here
    // saveAttachments runs automatically after test completes
    // No explicit call needed - it's an auto fixture
});
```

**Note:** Auto fixtures must be included in the test parameters to be activated, but they don't need to be explicitly called in the test body.

#### `saveBrowserVersion` (Auto Fixture)
**Auto fixture** that automatically saves browser version information for every test run. Runs automatically after the test completes.

**What it does:**
- Captures the browser version (e.g., "Chrome 120.0.6099.109")
- Saves it as a text file attachment
- Useful for debugging browser-specific issues

**Usage:**
```typescript
test('My test', async ({ page, saveBrowserVersion }) => {
    // Test code here
    // saveBrowserVersion runs automatically after test completes
    // No explicit call needed - it's an auto fixture
});
```

**Understanding Auto Fixtures:**
- Auto fixtures are marked with `{ auto: true }` in the fixture definition
- They automatically run AFTER the test completes, without needing explicit calls
- They must be included in the test parameters to be activated
- Useful for cleanup, artifact collection, and post-test actions

### Page Object Fixtures

Located in [`lib/page-object-fixtures.ts`](../lib/page-object-fixtures.ts):

- `exampleLoginPage` - Login page instance
- `exampleDashboardPage` - Dashboard page instance

## Best Practices

### 1. Use AllureHelper for Metadata

Always apply test metadata for better report organization:

```typescript
await AllureHelper.applyTestMetadata({
    displayName: "Test Name",
    owner: "Team Name",
    tags: ["Tag1", "Tag2"],
    severity: "critical",
    // ...
});
```

### 2. Capture Test Failures

Include the `afterEach` hook in all test files:

```typescript
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        await captureTestFailure(page, testInfo, new Error('Test failed'));
    }
});
```

### 3. Attach Screenshots Strategically

Attach screenshots at key verification points:

```typescript
await allure.step('Verify user added', async () => {
    expect(await page.isUserVisible()).toBe(true);
    await AllureHelper.attachScreenShot(page);  // Attach after verification
});
```

### 4. Use Helper Functions for Data Processing

Use CSV parsing functions for file validation:

```typescript
const csvContent = await downloadFile();
assertCsvColumns(csvContent, expectedColumns);
const rows = parseCsvContent(csvContent);
```

### 5. Log Important Events

Use logger for debugging and tracking:

```typescript
const logger = require('../lib/logger')(module);

logger.info('Starting test execution');
logger.error('Test failed', error);
```

## Related Documentation

- [Architecture Overview](01-architecture-overview.md) - Understanding fixtures
- [Test Development](03-test-development.md) - Using utilities in tests
- [Reporting](07-reporting.md) - Understanding Allure reports


















