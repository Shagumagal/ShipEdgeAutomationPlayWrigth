# Allure Implementation Guide

## Overview

This document explains how Allure reporting is implemented in our Playwright test framework. Allure is a powerful test reporting tool that creates beautiful, detailed HTML reports with test history, trends, and rich metadata.

**Why Allure?**
- Creates professional, easy-to-read test reports
- Tracks test execution history and trends over time
- Organizes tests using metadata (tags, severity, features, etc.)
- Integrates with Testlio platform for test management
- Provides visual attachments (screenshots) for debugging

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [AllureHelper Class](#allurehelper-class)
3. [Configuration Setup](#configuration-setup)
4. [How to Use in Tests](#how-to-use-in-tests)
5. [Common Patterns](#common-patterns)
6. [Generating and Viewing Reports](#generating-and-viewing-reports)
7. [Best Practices](#best-practices)

---

## Architecture Overview

### What is Allure?

Think of Allure as a **smart test reporter** that:
- Collects data while your tests run
- Stores results in JSON files (`allure-results/` directory)
- Generates beautiful HTML reports you can view in a browser
- Tracks test history so you can see trends over time

### How It Works in Our Framework

```
┌─────────────────┐
│  Test Execution │
│  (Playwright)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AllureHelper   │ ◄─── Adds metadata & screenshots
│  (Our Helper)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ allure-playwright│ ◄─── Playwright reporter plugin
│   (Reporter)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ allure-results/ │ ◄─── JSON files with test data
│   (Storage)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  allure:generate│ ◄─── Converts JSON to HTML
│   (CLI Tool)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  allure-report/ │ ◄─── Beautiful HTML report
│   (Output)      │
└─────────────────┘
```

### Key Components

1. **AllureHelper** (`lib/allure-helper.ts`)
   - Our custom helper class that simplifies Allure usage
   - Provides easy-to-use methods for common tasks

2. **Playwright Configuration** (`playwright.config.ts`)
   - Configures Allure reporter
   - Sets up result storage and categories

3. **Global Setup** (`global-setup.ts`)
   - Preserves test history between runs
   - Maintains trend data

---

## AllureHelper Class

The `AllureHelper` class is our **simplified interface** to Allure. Instead of calling Allure functions directly, we use this helper to make our code cleaner and more maintainable.

### Location
`lib/allure-helper.ts`

### Available Methods

#### 1. `applyTestMetadata(options)`

**What it does:** Adds structured information about your test to the Allure report.

**Why it matters:** This metadata helps organize tests, filter results, and understand test coverage at a glance.

**Parameters:**
```typescript
{
    displayName?: string;      // Friendly test name (shown in reports)
    owner?: string;            // Who owns/maintains this test
    tags?: string[];           // Labels for filtering (e.g., ["Smoke", "Regression"])
    severity?: string;          // How critical is this test? ("critical", "normal", "minor", etc.)
    epic?: string;             // High-level feature area
    feature?: string;          // Specific feature being tested
    story?: string;            // User story or scenario
    parentSuite?: string;      // Top-level test suite
    suite?: string;            // Test suite name
    subSuite?: string;         // Sub-suite name
}
```

**Example:**
```typescript
await AllureHelper.applyTestMetadata({
    displayName: "Add New User",
    owner: "QA Automation",
    tags: ["login", "authentication", "smoke", "critical"],
    severity: "critical",
    epic: "Authentication",
    feature: "User Management",
    story: "Add New User",
    parentSuite: "User Management",
    suite: "User Management",
    subSuite: "Regression"
});
```

**In Simple Terms:**
Think of this like filling out a form about your test:
- **displayName**: What would you call this test in plain English?
- **owner**: Who should be contacted if this test breaks?
- **tags**: What categories does this test belong to? (like hashtags)
- **severity**: How important is this test? (critical = must pass, minor = nice to have)
- **epic/feature/story**: Where does this test fit in the product? (like a filing system)
- **suites**: How should tests be grouped together?

#### 2. `attachScreenShot(page)`

**What it does:** Takes a full-page screenshot and attaches it to the Allure report.

**Why it matters:** Screenshots help debug failures by showing exactly what the page looked like when something went wrong.

**Parameters:**
- `page`: The Playwright Page object

**Example:**
```typescript
await AllureHelper.attachScreenShot(page);
```

**In Simple Terms:**
This is like taking a photo of your screen and saving it with your test report. If the test fails, you can look at the screenshot to see what went wrong.

**When to use:**
- After important verification steps
- When a test fails (for debugging)
- At the end of a test to show final state

---

## Configuration Setup

### Playwright Configuration

Allure is configured in `playwright.config.ts` as a reporter:

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

**In Simple Terms:**
- **resultsDir**: Where to save test result files (like a folder for storing test data)
- **categories**: How to group tests by their status (passed, failed, skipped)
- **environmentInfo**: Information about the computer/environment where tests ran (helps debug environment-specific issues)

### Dependencies

The following packages are required (already in `package.json`):

- **`allure-playwright`**: The Playwright reporter plugin
- **`allure-js-commons`**: Core Allure JavaScript library
- **`allure-commandline`**: CLI tools for generating reports

### Global Setup

The `global-setup.ts` file copies Allure history from previous reports to maintain trend data.

**In Simple Terms:**
When you run tests multiple times, Allure keeps track of historical data (like "this test passed 5 times in a row"). The global setup ensures this history isn't lost between test runs.

---

## How to Use in Tests

### Step-by-Step Guide

#### Step 1: Import Required Modules

At the top of your test file:

```typescript
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';
```

**In Simple Terms:**
- `allure`: The main Allure library (for steps and labels)
- `AllureHelper`: Our helper class (for metadata and screenshots)

#### Step 2: Apply Test Metadata

At the beginning of your test:

```typescript
test('TC-001: Successful Login with Valid Credentials', async ({ page, exampleLoginPage }) => {
    await AllureHelper.applyTestMetadata({
        displayName: "Add New User",
        owner: "QA Automation",
        tags: ["login", "authentication", "smoke"],
        severity: "critical",
        epic: "Authentication",
        feature: "User Management",
        story: "Add New User",
        parentSuite: "User Management",
        suite: "User Management",
        subSuite: "Regression"
    });
    
    // ... rest of your test
});
```

**In Simple Terms:**
Tell Allure about your test before it runs. This is like labeling a file before putting it in a filing cabinet.

#### Step 3: Add Manual Test ID (optional, if using a test management platform)

```typescript
// Optional: Link to manual test case in your test management platform
// allure.label('manualTestID', 'your-test-id-here');
```

**In Simple Terms:**
This links your automated test to a manual test case in your test management platform. It's like adding a reference number.

#### Step 4: Wrap Test Actions in Allure Steps

Break your test into logical steps:

```typescript
await allure.step('1. Navigate to Manage Users page', async () => {
    await exampleDashboardPage.clickOnManageUsersLink();
    await waitForPageLoad();
    await exampleLoginPage.waitForURLContains('/users');
    expect(await exampleLoginPage.isManageUsersHeadingVisible()).toBe(true);
});

await allure.step('2. Click on Add User button', async () => {
    await exampleLoginPage.clickOnAddUserButton();
    await waitForPageLoad();
});
```

**In Simple Terms:**
Instead of having one big test, break it into smaller steps. Each step appears separately in the Allure report, making it easier to see where a test failed.

**Benefits:**
- See which step failed
- See how long each step took
- Understand test flow at a glance

#### Step 5: Attach Screenshots (when needed)

```typescript
await allure.step('10. Verify invited user appears in table', async () => {
    // ... verification code ...
    await AllureHelper.attachScreenShot(page);  // Attach screenshot
});
```

**In Simple Terms:**
Take a picture of the page at important moments. This helps when debugging failures.

### Complete Example

```typescript
import { test, expect } from './../lib/page-object-fixtures';
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';

test('TC-001: Successful Login with Valid Credentials', async ({ page, exampleLoginPage, 
    exampleLoginPage, waitForPageLoad }) => {

    // Step 1: Apply metadata
    await AllureHelper.applyTestMetadata({
        displayName: "Add New User",
        owner: "QA Automation",
        tags: ["login", "authentication", "smoke"],
        severity: "critical",
        epic: "Authentication",
        feature: "User Management",
        story: "Add New User",
        parentSuite: "User Management",
        suite: "User Management",
        subSuite: "Regression"
    });

    // Step 2: Add Testlio ID
    // Optional: Link to manual test case in your test management platform
// allure.label('manualTestID', 'your-test-id-here');

    // Step 3: Break test into steps
    await allure.step('1. Navigate to Manage Users page', async () => {
        await exampleDashboardPage.clickOnManageUsersLink();
        await waitForPageLoad();
    });

    await allure.step('2. Click on Add User button', async () => {
        await exampleLoginPage.clickOnAddUserButton();
        await waitForPageLoad();
    });

    await allure.step('3. Fill in user details', async () => {
        await exampleLoginPage.typeInFirstNameInput('John');
        await exampleLoginPage.typeInLastNameInput('Doe');
        await exampleLoginPage.typeInEmailInput('john.doe@example.com');
    });

    // Step 4: Attach screenshot at important points
    await allure.step('4. Verify user was added', async () => {
        expect(await exampleLoginPage.isUserVisible('John Doe')).toBe(true);
        await AllureHelper.attachScreenShot(page);
    });
});
```

---

## Common Patterns

### Pattern 1: Basic Test with Metadata

```typescript
test('Test Name', async ({ page }) => {
    await AllureHelper.applyTestMetadata({
        displayName: "Friendly Test Name",
        tags: ["Smoke"],
        severity: "critical"
    });
    
    // Test code here
});
```

### Pattern 2: Test with Steps

```typescript
test('Test Name', async ({ page }) => {
    await AllureHelper.applyTestMetadata({ /* ... */ });
    
    await allure.step('Step 1: Do something', async () => {
        // Action
    });
    
    await allure.step('Step 2: Verify something', async () => {
        // Verification
    });
});
```

### Pattern 3: Test with Screenshot

```typescript
test('Test Name', async ({ page }) => {
    await AllureHelper.applyTestMetadata({ /* ... */ });
    
    await allure.step('Verify page state', async () => {
        // Verification code
        await AllureHelper.attachScreenShot(page);
    });
});
```

### Pattern 4: Test Management Platform Integration (Optional)

```typescript
test('Test Name', async ({ page }) => {
    await AllureHelper.applyTestMetadata({ /* ... */ });
    // Optional: Link to manual test case in your test management platform
    // allure.label('manualTestID', 'your-test-id-here');
    
    // Test code
});
```

---

## Generating and Viewing Reports

### Running Tests

When you run tests, Allure automatically collects data:

```bash
npm run test:smoke-chrome
```

This creates JSON files in the `allure-results/` directory.

**In Simple Terms:**
Running tests creates data files. These files contain all the information about your tests (what passed, what failed, how long they took, etc.).

### Generating HTML Report

After running tests, generate the HTML report:

```bash
npm run allure:generate
```

**What it does:**
- Reads JSON files from `allure-results/`
- Converts them into a beautiful HTML report
- Saves it in `allure-report/` directory

**In Simple Terms:**
This converts the raw data files into a website you can view in your browser.

### Opening the Report

View the report in your browser:

```bash
npm run allure:open
```

**What it does:**
- Opens the generated HTML report in your default browser
- Shows test results, history, trends, and attachments

**In Simple Terms:**
This opens the test report website so you can see all your test results in a nice, organized format.

### Report Features

The Allure report includes:

1. **Overview**: Summary of all tests (passed, failed, skipped)
2. **Suites**: Tests organized by suite hierarchy
3. **Graphs**: Visual charts showing test trends
4. **Timeline**: When tests ran and how long they took
5. **Behaviors**: Tests organized by epic/feature/story
6. **Packages**: Tests organized by package/file
7. **Test Cases**: Individual test details with steps and attachments

---

## Best Practices

### 1. Always Apply Metadata

**Do:**
```typescript
await AllureHelper.applyTestMetadata({
    displayName: "Clear Test Name",
    tags: ["Smoke", "Regression"],
    severity: "critical"
});
```

**Don't:**
```typescript
// Missing metadata makes reports less useful
test('test', async ({ page }) => {
    // Test code
});
```

**Why:** Metadata helps organize and filter tests in reports.

### 2. Use Descriptive Step Names

**Do:**
```typescript
await allure.step('1. Navigate to Manage Users page', async () => {
    // Code
});
```

**Don't:**
```typescript
await allure.step('Step 1', async () => {
    // Code
});
```

**Why:** Clear step names make it easy to understand what happened when a test fails.

### 3. Break Tests into Logical Steps

**Do:**
```typescript
await allure.step('1. Navigate to page', async () => { /* ... */ });
await allure.step('2. Fill form', async () => { /* ... */ });
await allure.step('3. Submit form', async () => { /* ... */ });
await allure.step('4. Verify success', async () => { /* ... */ });
```

**Don't:**
```typescript
await allure.step('Do everything', async () => {
    // All test code in one step
});
```

**Why:** Smaller steps make it easier to identify where failures occur.

### 4. Attach Screenshots Strategically

**Do:**
```typescript
await allure.step('Verify user was added', async () => {
    expect(userVisible).toBe(true);
    await AllureHelper.attachScreenShot(page);  // After verification
});
```

**Don't:**
```typescript
// Attaching screenshots at every single action
await AllureHelper.attachScreenShot(page);  // Too many screenshots
await clickButton();
await AllureHelper.attachScreenShot(page);  // Clutters report
await typeText();
await AllureHelper.attachScreenShot(page);  // Unnecessary
```

**Why:** Screenshots are most valuable at key verification points, not every action.

### 5. Use Consistent Tagging

**Do:**
```typescript
tags: ["login", "authentication", "smoke"]
```

**Don't:**
```typescript
tags: ["test", "login", "smoke"]  // Inconsistent capitalization
tags: ["Login", "authentication", "SMOKE"]  // Mixed styles
```

**Why:** Consistent tags make filtering and searching easier.

### 6. Set Appropriate Severity

Use severity levels consistently:
- **`critical`**: Core functionality, must pass
- **`normal`**: Important features
- **`minor`**: Nice-to-have features
- **`trivial`**: Cosmetic or low-impact tests

**Why:** Severity helps prioritize which test failures need immediate attention.

### 7. Link to Manual Tests (Optional)

**Do:**
```typescript
// Optional: Link to manual test case in your test management platform
// allure.label('manualTestID', 'your-test-id-here');
```

**Why:** Links automated tests to manual test cases for traceability.

---

## Troubleshooting

### Report Not Generating

**Problem:** `allure:generate` fails or produces empty report

**Solutions:**
1. Ensure tests have run: Check that `allure-results/` directory exists and contains JSON files
2. Verify Allure CLI is installed: `npm list allure-commandline`
3. Check for errors in console output

### Missing Screenshots

**Problem:** Screenshots don't appear in report

**Solutions:**
1. Ensure `AllureHelper.attachScreenShot(page)` is called correctly
2. Check that `page` object is valid
3. Verify screenshot was taken before test ended

### Missing Metadata

**Problem:** Test metadata doesn't appear in report

**Solutions:**
1. Ensure `AllureHelper.applyTestMetadata()` is called at the start of the test
2. Verify it's called before any test steps
3. Check that metadata object is properly formatted

### History Not Preserved

**Problem:** Test history is lost between runs

**Solutions:**
1. Ensure `global-setup.ts` is configured correctly
2. Run `allure:generate` before running new tests (to create history)
3. Check that `allure-report/history/` directory exists

---

## Summary

### Key Takeaways

1. **AllureHelper simplifies Allure usage** - Use it instead of calling Allure directly
2. **Metadata organizes tests** - Always apply metadata at test start
3. **Steps break down tests** - Use `allure.step()` for logical test sections
4. **Screenshots aid debugging** - Attach at key verification points
5. **Reports require generation** - Run `allure:generate` after tests, then `allure:open` to view

### Quick Reference

```typescript
// Import
import * as allure from "allure-js-commons";
import AllureHelper from '../lib/allure-helper';

// Apply metadata
await AllureHelper.applyTestMetadata({ /* options */ });

// Add Testlio ID
// Optional: Link to manual test case
// allure.label('manualTestID', 'id-here');

// Create step
await allure.step('Step name', async () => { /* code */ });

// Attach screenshot
await AllureHelper.attachScreenShot(page);

// Generate report
npm run allure:generate

// Open report
npm run allure:open
```

---

## Additional Resources

- [Allure Playwright Documentation](https://allurereport.org/docs/playwright/)
- [Allure Report Documentation](https://allurereport.org/docs/)
- [Project Reporting Guide](./07-reporting.md)
- [Utilities and Helpers Guide](./06-utilities-and-helpers.md)

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained By:** QA Automation Team
