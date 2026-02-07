# Logging with Winston

## Overview

This project uses [Winston](https://github.com/winstonjs/winston) for structured logging throughout the test execution cycle. Winston provides a flexible logging framework with multiple log levels, customizable formats, and the ability to output to different transports (console, files, etc.).

## Logger Configuration

The logger is configured in [`lib/logger.ts`](../lib/logger.ts) and provides:

- **Structured logging** with timestamps, log levels, and module labels
- **Console output** by default (can be extended to file logging)
- **Automatic module labeling** based on the calling file's path
- **Consistent formatting** across all log messages

### Logger Format

Logs are formatted as:
```
YYYY-MM-DD HH:mm:ss [level] [module/path]: message
```

Example output:
```
2026-02-07 12:28:16 [info] [lib/helpers-fixtures]: Test started
2026-02-07 12:28:45 [error] [lib/test-failure-capture]: Test failed - capturing artifacts
```

## Usage

### Basic Usage

Import and initialize the logger in any file:

```typescript
import logger from '../lib/logger';

// Initialize logger with current file's path
const log = logger({ filename: __filename });

// Use different log levels
log.info('Information message');
log.debug('Debug information', { additional: 'data' });
log.warn('Warning message', { reason: 'something' });
log.error('Error occurred', { error: error.message });
```

### Log Levels

The logger supports the following log levels (in order of severity):

1. **`error`** - Error events that might still allow the application to continue
2. **`warn`** - Warning messages for potentially harmful situations
3. **`info`** - Informational messages highlighting progress
4. **`debug`** - Detailed information for debugging

### Structured Logging

Always include structured data with your log messages for better analysis:

```typescript
log.info('Test started', {
    testId: testInfo.title,
    project: testInfo.project.name,
    retry: testInfo.retry
});

log.error('Test failed', {
    testTitle: testInfo.title,
    status: testInfo.status,
    duration: testInfo.duration,
    error: error.message,
    url: page.url()
});
```

## Automatic Logging Integration

The logger is automatically integrated into the following parts of the test execution cycle:

### 1. Test Lifecycle Hooks

**Location:** `lib/helpers-fixtures.ts`

Automatically logs:
- **Test Start** - When each test begins (with test metadata)
- **Test Completion** - When each test finishes (with status, duration, retry count)

```typescript
// Automatically logged for every test
test.beforeEach(async ({ }, testInfo) => {
    // Logs: "Test started" with test metadata
});

test.afterEach(async ({ }, testInfo) => {
    // Logs: "Test passed/failed/skipped" with test results
});
```

**Example Output:**
```
2026-02-07 12:28:16 [info] [lib/helpers-fixtures]: Test started { testId: 'TC-001: Successful Login', project: 'chromium', retry: 0 }
2026-02-07 12:28:45 [info] [lib/helpers-fixtures]: Test passed { testId: 'TC-001: Successful Login', status: 'passed', duration: 29000, retry: 0 }
```

### 2. Global Setup

**Location:** `global-setup.ts`

Logs test suite initialization:
- Test suite start with configuration details
- Allure history copy status
- Global setup completion

**Example Output:**
```
2026-02-07 12:25:00 [info] [global-setup]: Starting test suite execution { workers: 4, projects: ['chromium', 'firefox'], baseURL: 'https://example.com' }
2026-02-07 12:25:01 [info] [global-setup]: Allure history copied successfully
2026-02-07 12:25:01 [info] [global-setup]: Global setup completed
```

### 3. Test Failure Capture

**Location:** `lib/test-failure-capture.ts`

Enhanced with logging when capturing failure artifacts:
- Logs when failure artifacts are being captured
- Logs successful artifact capture
- Logs errors if artifact capture fails

**Example Output:**
```
2026-02-07 12:30:15 [error] [lib/test-failure-capture]: Capturing test failure artifacts { testTitle: 'TC-001: Login Test', status: 'failed', url: 'https://example.com/login', retry: 0 }
2026-02-07 12:30:16 [info] [lib/test-failure-capture]: Test failure artifacts captured successfully { testTitle: 'TC-001: Login Test', artifacts: ['screenshot', 'page_source', 'error_message', 'current_url'] }
```

### 4. Helper Fixtures

**Location:** `lib/helpers-fixtures.ts`

Logs activity in helper fixtures:
- **`waitForPageLoad`** - Page load start and completion
- **`saveAttachments`** - Test failure artifact capture
- **`saveBrowserVersion`** - Browser version capture

**Example Output:**
```
2026-02-07 12:28:16 [debug] [lib/helpers-fixtures]: Waiting for page load { url: 'https://example.com' }
2026-02-07 12:28:18 [debug] [lib/helpers-fixtures]: Page load completed
2026-02-07 12:28:20 [debug] [lib/helpers-fixtures]: Browser version captured { browser: 'chromium', version: '120.0.6099.109' }
```

## Using Logger in Your Tests

### In Test Files

You can add custom logging in your test files:

```typescript
import { test, expect } from '../lib/page-object-fixtures';
import logger from '../lib/logger';

const log = logger({ filename: __filename });

test('My test', async ({ page, exampleLoginPage }) => {
    log.info('Starting login test');
    
    await exampleLoginPage.navigateToLogin();
    log.debug('Navigated to login page', { url: page.url() });
    
    await exampleLoginPage.login('user@example.com', 'password');
    log.info('Login attempt completed');
    
    // ... rest of test
});
```

### In Page Objects

Add logging to page object methods for better traceability:

```typescript
import logger from '../lib/logger';

const log = logger({ filename: __filename });

export class LoginPage {
    async login(email: string, password: string) {
        log.debug('Attempting login', { email: this.maskEmail(email) });
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.clickSubmit();
        log.info('Login submitted successfully');
    }
    
    private maskEmail(email: string): string {
        // Mask sensitive data in logs
        return email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    }
}
```

## Best Practices

### 1. Use Appropriate Log Levels

- **`error`** - For test failures, exceptions, critical issues
- **`warn`** - For retries, timeouts, non-critical issues
- **`info`** - For test milestones, major steps, test start/end
- **`debug`** - For detailed debugging, element interactions, page loads

### 2. Include Structured Data

Always include relevant context in log messages:

```typescript
// Good ✅
log.error('Test failed', {
    testTitle: testInfo.title,
    status: testInfo.status,
    url: page.url(),
    retry: testInfo.retry
});

// Avoid ❌
log.error('Test failed');
```

### 3. Mask Sensitive Information

Never log passwords, tokens, or PII in plain text:

```typescript
// Good ✅
log.debug('Login attempt', { 
    email: this.maskEmail(email),
    // Don't log password
});

// Avoid ❌
log.debug('Login attempt', { email, password });
```

### 4. Keep Logging Lightweight

Avoid logging in tight loops or high-frequency operations:

```typescript
// Good ✅ - Log once per operation
log.info('Processing batch', { batchSize: items.length });
for (const item of items) {
    // Process item without logging each iteration
}

// Avoid ❌ - Logging in loop
for (const item of items) {
    log.debug('Processing item', { item }); // Too verbose
}
```

### 5. Use Descriptive Messages

Make log messages clear and actionable:

```typescript
// Good ✅
log.info('Test started', { testId: testInfo.title });
log.error('Element not found', { selector: '#submit-button', timeout: 5000 });

// Avoid ❌
log.info('Started');
log.error('Error');
```

## Log Output Locations

### Console Output

By default, all logs are output to the console. This is useful for:
- Local development and debugging
- Real-time test execution monitoring
- CI/CD pipeline output

### Future: File Logging

The logger can be extended to write logs to files:

```typescript
// Example: Add file transport (not currently implemented)
import { createLogger, transports } from 'winston';

const logger = createLogger({
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'test-execution.log' })
    ]
});
```

## Troubleshooting

### Logger Not Working

If logs aren't appearing:

1. **Check logger import** - Ensure you're importing from the correct path
2. **Verify winston is installed** - Run `npm list winston`
3. **Check log level** - Debug logs might be filtered out
4. **Verify file path** - Ensure `__filename` is available in your context

### Too Many Logs

If logs are too verbose:

1. **Adjust log levels** - Use `info` instead of `debug` for less verbose output
2. **Remove unnecessary logs** - Don't log in tight loops
3. **Use conditional logging** - Only log when needed:

```typescript
if (process.env.DEBUG === 'true') {
    log.debug('Detailed information', { data });
}
```

## Integration Points Summary

| Location | What's Logged | Log Level |
|----------|---------------|-----------|
| `test.beforeEach` | Test start with metadata | `info` |
| `test.afterEach` | Test completion with results | `info`/`error`/`warn` |
| `global-setup.ts` | Suite initialization | `info` |
| `waitForPageLoad` | Page load operations | `debug` |
| `saveAttachments` | Test failure artifact capture | `error` |
| `saveBrowserVersion` | Browser version capture | `debug` |
| `captureTestFailure` | Failure artifact capture | `error`/`info` |

## Related Documentation

- [Utilities and Helpers](06-utilities-and-helpers.md) - Other utility functions
- [Test Development](03-test-development.md) - Writing tests
- [Troubleshooting](11-troubleshooting.md) - Debugging test issues
