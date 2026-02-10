# CI/CD Integration

This document explains the CI/CD pipeline configuration and GitHub Actions workflow.

## GitHub Actions Workflow

The project uses GitHub Actions for continuous integration. The workflow file is located at [`.github/workflows/github-actions-run.yml`](../.github/workflows/github-actions-run.yml).

## Workflow Overview

The workflow supports both manual triggers and scheduled runs (optional):

- **Manual trigger**: Run tests on-demand with custom parameters via GitHub Actions UI
- **Scheduled runs**: Automatic execution at specified intervals (disabled by default)

### Workflow Triggers

```yaml
on:
  workflow_dispatch:
    inputs:
      branch:
        description: 'Branch to run tests on'
        required: true
        default: 'main'
        type: string
      test_case:
        description: 'Test case file to run (e.g. login.spec.ts). Leave empty to run all tests'
        required: false
        type: string
      workers:
        description: 'Number of parallel workers (default: 1)'
        required: false
        default: '1'
        type: string
      retries:
        description: 'Number of retries for failed tests'
        required: false
        default: '3'
        type: string
  # Scheduled runs are commented out by default
  # Uncomment the schedule section below to enable automated test runs
  # schedule:
  #   - cron: "0 3 * * *"  # Runs tests automatically every day at 3:00 AM UTC
```

### Enabling Scheduled Test Execution

To enable automated scheduled test runs:

1. Open `.github/workflows/github-actions-run.yml`
2. Uncomment the `schedule` section
3. Adjust the cron expression to your desired schedule

#### Cron Syntax Explained

The cron syntax follows the format: `"minute hour day-of-month month day-of-week"`

**Field Values:**
- **Minute** (0-59): The minute of the hour
- **Hour** (0-23): The hour of the day (24-hour format)
- **Day of month** (1-31): The day of the month
- **Month** (1-12): The month of the year
- **Day of week** (0-7): The day of the week (0 or 7 = Sunday)

**Special Characters:**
- `*` - Matches any value
- `,` - Separates multiple values (e.g., `1,3,5`)
- `-` - Specifies a range (e.g., `1-5`)
- `/` - Specifies intervals (e.g., `*/6` means every 6 units)

#### Common Cron Examples

```yaml
# Every day at 3:00 AM UTC
schedule:
  - cron: "0 3 * * *"

# Every 6 hours
schedule:
  - cron: "0 */6 * * *"

# Every weekday (Monday-Friday) at 9:00 AM UTC
schedule:
  - cron: "0 9 * * 1-5"

# First day of every month at midnight UTC
schedule:
  - cron: "0 0 1 * *"

# Every Sunday at 2:30 PM UTC
schedule:
  - cron: "30 14 * * 0"

# Every Monday, Wednesday, and Friday at 8:00 AM UTC
schedule:
  - cron: "0 8 * * 1,3,5"

# Every hour during business hours (9 AM - 5 PM UTC) on weekdays
schedule:
  - cron: "0 9-17 * * 1-5"
```

**Important Notes:**
- GitHub Actions uses **UTC timezone** for all scheduled runs
- Adjust your cron expression accordingly for your local timezone
- Scheduled workflows may be delayed during high load periods
- GitHub Actions requires at least one commit in the default branch for scheduled workflows to run

## Workflow Structure

### Job Configuration

```yaml
jobs:
  consumer-platform-tests:
    timeout-minutes: 180
    runs-on: ubuntu-latest
    env:
      RUN_API_TOKEN: ${{ secrets.RUN_API_TOKEN }}
      CHROME_GUID: ${{ secrets.LOCAL_BROWSER_CHROME_GUID }}
      EDGE_GUID: ${{ secrets.PLAYWRIGHT_BROWSER_EDGE_GUID }}
      FIREFOX_GUID: ${{ secrets.PLAYWRIGHT_BROWSER_FIREFOX_GUID }}
      WEBKIT_GUID: ${{ secrets.PLAYWRIGHT_BROWSER_WEBKIT_GUID }}
```

### Workflow Steps

#### 1. Checkout Code

```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.inputs.branch || 'main' }}
```

#### 2. Setup Node.js

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: lts/*
```

#### 3. Install Dependencies

```yaml
- name: Install dependencies
  run: npm i --include=dev
```

#### 4. Install Playwright Browsers

```yaml
- name: Install Playwright Browsers
  run: npx playwright install chromium msedge firefox webkit --with-deps
```

#### 5. Create Test Management Platform Run (Optional)

If you're using a test management platform, create a run before executing tests:

```yaml
- name: Create Platform run
  run: |
    # Replace with your platform's CLI commands
    # npx your-platform-cli create-run \
    #   --config platform-cli/config.json
  if: always()
```

This step creates a run in your test management platform before executing tests.

#### 6. Run Tests and Upload Results per Browser

The workflow runs tests for each browser separately and uploads results:

**Chrome Example:**

```yaml
- name: Upload Chrome Results
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
    # ... more credentials
  run: |
    rm -rf allure-results
    npm run test:smoke-chrome || true
    mv allure-results allure-results-chrome || true
    mv allure-results-chrome allure-results || true
    zip -r allure-results-chrome.zip allure-results || true
    # Optional: Upload results to your test management platform
    # npx your-platform-cli upload-results \
    #   --config platform-cli/config.json \
    #   --path allure-results-chrome.zip \
    #   --browser chrome || true
  if: always()
```

The same pattern is repeated for Edge, Firefox, and WebKit browsers.

#### 7. Finalize Test Management Platform Results (Optional)

If you're using a test management platform, finalize the run:

```yaml
- name: Finalize Results
  run: |
    # Replace with your platform's CLI commands
    # npx your-platform-cli finalize-results --config platform-cli/config.json
  if: always()
```

This step finalizes the test run in your test management platform, making results available.

#### 8. Upload Artifacts

```yaml
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: test-results
    path: test-results/
    retention-days: 7

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: env-file
    path: .env
    retention-days: 30
    include-hidden-files: true
```

## Multi-Browser Testing Strategy

The workflow tests on four browsers:

1. **Chrome** (Chromium) - Version 141
2. **Edge** (Microsoft Edge) - Version 140
3. **Firefox** - Version 144
4. **WebKit** (Safari) - Version 230

### Browser-Specific Test Execution

Each browser runs tests independently:

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

### Result Isolation

Results for each browser are:
1. Generated in separate `allure-results-{browser}` directories
2. Zipped into separate archive files
3. Uploaded to test management platform with browser-specific identifiers (if configured)

## Test Management Platform Integration (Optional)

If you're using a test management platform, you can integrate it into your CI/CD pipeline.

### Platform CLI Commands

The workflow can use your platform's CLI commands:

#### 1. Create Run

Creates a new test run in your platform:

```bash
# Replace with your platform's CLI commands
# npx your-platform-cli create-run \
#   --config platform-cli/config.json \
#   --browsers "$CHROME_ID,$EDGE_ID,$FIREFOX_ID,$WEBKIT_ID"
```

#### 2. Upload Results

Uploads test results for a specific browser:

```bash
# Replace with your platform's CLI commands
# npx your-platform-cli upload-results \
#   --config platform-cli/config.json \
#   --path allure-results-chrome.zip \
#   --browser chrome
```

#### 3. Finalize Results

Finalizes the test run, making results available:

```bash
# Replace with your platform's CLI commands
# npx your-platform-cli finalize-results \
#   --config platform-cli/config.json
```

### Platform Configuration Files

If using a test management platform, create configuration files in a dedicated directory (e.g., `platform-cli/`).

See [Configuration documentation](02-configuration.md) for details.

## Environment Secrets

The workflow requires the following GitHub Secrets:

### Test Management Platform Configuration (Optional)

If using a test management platform, you may need:

- `PLATFORM_API_TOKEN` - API token for your platform
- `CHROME_BROWSER_ID` - Chrome browser identifier in your platform
- `EDGE_BROWSER_ID` - Edge browser identifier in your platform
- `FIREFOX_BROWSER_ID` - Firefox browser identifier in your platform
- `WEBKIT_BROWSER_ID` - WebKit browser identifier in your platform

### Application Credentials

- `TEST_USER_EMAIL` - Test user email
- `TEST_USER_PASSWORD` - Test user password

### Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its corresponding value

## Artifact Management

### Artifacts Uploaded

1. **Playwright Report** (`playwright-report/`)
   - HTML report with test results
   - Retention: 30 days
   - Only uploaded if workflow not cancelled

2. **Test Results** (`test-results/`)
   - Screenshots, videos, and traces
   - Retention: 7 days
   - Always uploaded (even on failure)

3. **Environment File** (`.env`)
   - Environment configuration
   - Retention: 30 days
   - Always uploaded

### Accessing Artifacts

1. Go to the workflow run in GitHub Actions
2. Scroll to the **Artifacts** section
3. Download the desired artifact

## Error Handling

The workflow uses `if: always()` and `|| true` to ensure:

- Tests continue even if one browser fails
- Results are uploaded even if tests fail
- Artifacts are saved regardless of test status
- Test management platform run is finalized even with failures (if configured)

### Example Error Handling

```yaml
- name: Upload Chrome Results
  run: |
    npm run test:smoke-chrome || true  # Continue even on failure
    # ... upload results
  if: always()  # Run even if previous steps failed
```

## Workflow Best Practices

### 1. Use `if: always()` for Critical Steps

Steps that should run regardless of test results:

```yaml
- name: Finalize Results
  run: npx testlio finalize-results ...
  if: always()
```

### 2. Handle Failures Gracefully

Use `|| true` to prevent workflow failure from stopping execution:

```yaml
run: |
  npm run test:smoke-chrome || true
  # Continue with result upload
```

### 3. Isolate Browser Results

Keep results separate for each browser to avoid conflicts:

```yaml
run: |
  rm -rf allure-results
  npm run test:smoke-chrome
  mv allure-results allure-results-chrome
```

### 4. Set Appropriate Timeouts

Configure job timeout to prevent hanging workflows:

```yaml
jobs:
  consumer-platform-tests:
    timeout-minutes: 180  # 3 hours
```

### 5. Use Secrets for Sensitive Data

Never hardcode credentials. Always use GitHub Secrets:

```yaml
env:
  TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
  TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

## Monitoring Workflow Runs

### Viewing Workflow Status

1. Go to the **Actions** tab in GitHub
2. Select the workflow
3. View run status, logs, and artifacts

### Common Issues

1. **Tests timing out**: Increase `timeout-minutes` in job configuration
2. **Missing secrets**: Ensure all required secrets are configured
3. **Browser installation failures**: Check network connectivity and Playwright version
4. **Platform upload failures**: Verify API token and browser identifiers (if using a test management platform)

## Related Documentation

- [Configuration](02-configuration.md) - Configuration details
- [Reporting](07-reporting.md) - Understanding test reports
- [Project Setup](08-project-setup.md) - Local setup instructions


















