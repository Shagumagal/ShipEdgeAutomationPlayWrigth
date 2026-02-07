# Multi-Browser Setup for Parallel Execution

This guide explains how to set up and use multiple browsers for parallel test execution, which significantly reduces test execution time and provides comprehensive cross-browser coverage.

## Overview

The Playwright framework supports running tests across multiple browsers simultaneously. By default, the configuration includes four browser projects:

- **Chromium** (Chrome)
- **Microsoft Edge**
- **Firefox**
- **WebKit** (Safari)

## Installing Browsers

### Install All Browsers (Recommended)

To enable full parallel execution capabilities, install all browsers:

```bash
npx playwright install chromium msedge firefox webkit --with-deps
```

This command:
- Downloads browser binaries for all four browsers
- Installs system dependencies (`--with-deps` flag)
- Enables parallel test execution across browsers

### Install Individual Browsers

You can install browsers individually if needed:

```bash
# Chrome/Chromium
npx playwright install chromium --with-deps

# Microsoft Edge
npx playwright install msedge --with-deps

# Firefox
npx playwright install firefox --with-deps

# Safari/WebKit
npx playwright install webkit --with-deps
```

### System Dependencies

The `--with-deps` flag installs system dependencies required for browsers. On Linux, this may require sudo permissions:

```bash
# Linux - may require sudo
sudo npx playwright install-deps

# Or install dependencies for specific browser
sudo npx playwright install-deps chromium
```

## Running Tests Across Browsers

### Parallel Execution (All Browsers)

Once all browsers are installed, run tests across all browsers simultaneously:

```bash
# Run all tests on all browsers in parallel
npx playwright test

# Specify number of parallel workers
npx playwright test --workers=4
```

**How it works:**
- Each browser project runs tests in parallel
- Tests are distributed across available workers
- Results are aggregated across all browsers

### Single Browser Execution

Run tests on a specific browser:

```bash
# Chrome only
npx playwright test --project=chromium
# Or use npm script
npm run test:smoke-chrome

# Edge only
npx playwright test --project=msedge
npm run test:smoke-edge

# Firefox only
npx playwright test --project=firefox
npm run test:smoke-firefox

# Safari/WebKit only
npx playwright test --project=webkit
npm run test:smoke-safari
```

## Configuration

### Browser Projects

Browser projects are configured in `playwright.config.ts`:

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

### Parallel Workers

Configure the number of parallel workers:

```typescript
// In playwright.config.ts
workers: process.env.CI ? 1 : 4, // 4 workers locally, 1 in CI

// Or via command line
npx playwright test --workers=4
```

**Recommendations:**
- **Local development**: 4-8 workers (based on CPU cores)
- **CI/CD**: 1-2 workers (to avoid resource contention)
- **Powerful machines**: Up to 8-16 workers

### Fully Parallel Mode

Enable fully parallel execution:

```typescript
fullyParallel: true, // Tests in different files run in parallel
```

## Benefits of Multi-Browser Setup

### 1. Faster Test Execution

Running tests in parallel across browsers significantly reduces total execution time:

```
Single browser (sequential):  4 browsers × 5 min = 20 minutes
Multi-browser (parallel):     4 browsers × 5 min = ~5 minutes
```

### 2. Cross-Browser Coverage

Verify your application works correctly across:
- **Chromium** (Blink engine) - Chrome, Edge, Opera
- **Firefox** (Gecko engine) - Firefox browser
- **WebKit** (WebKit engine) - Safari, some mobile browsers

### 3. Early Detection of Browser-Specific Issues

Catch browser-specific bugs early:
- CSS rendering differences
- JavaScript compatibility issues
- API behavior variations
- Performance differences

### 4. Flexible Test Execution

Run tests based on your needs:
- All browsers for comprehensive coverage
- Specific browsers for targeted testing
- Single browser for quick feedback

## Best Practices

### 1. Install All Browsers During Setup

Install all browsers upfront to enable full parallel execution:

```bash
npx playwright install chromium msedge firefox webkit --with-deps
```

### 2. Use Appropriate Worker Count

Balance speed vs. resource usage:

```typescript
// Local development
workers: 4

// CI/CD (more conservative)
workers: 1
```

### 3. Tag Tests for Browser-Specific Runs

Use tags to run browser-specific tests:

```typescript
test('Chrome-specific feature', { tag: '@chrome' }, async ({ page }) => {
  // Test code
});

// Run only Chrome-tagged tests
npx playwright test --grep @chrome
```

### 4. Monitor Resource Usage

Parallel execution uses more resources:
- CPU: Higher usage with more workers
- Memory: Each browser instance uses memory
- Network: Multiple concurrent requests

Adjust workers based on your machine's capabilities.

## Troubleshooting

### Browser Not Installed Error

**Error:** `Executable doesn't exist at /path/to/browser`

**Solution:**
```bash
# Install the missing browser
npx playwright install <browser-name> --with-deps

# Or install all browsers
npx playwright install chromium msedge firefox webkit --with-deps
```

### Out of Memory Errors

**Error:** Tests fail with memory-related errors

**Solution:**
- Reduce number of workers
- Run browsers sequentially instead of parallel
- Close other applications to free memory

```typescript
// Reduce workers
workers: 2 // Instead of 4
```

### Slow Test Execution

**Symptoms:** Tests run slower than expected

**Solutions:**
1. Check if browsers are actually running in parallel
2. Verify worker count is appropriate
3. Ensure `fullyParallel: true` is set
4. Check for resource constraints (CPU, memory)

## CI/CD Considerations

In CI/CD environments:

1. **Install all browsers** in the workflow:
   ```yaml
   - name: Install Playwright Browsers
     run: npx playwright install chromium msedge firefox webkit --with-deps
   ```

2. **Use conservative worker count**:
   ```typescript
   workers: process.env.CI ? 1 : 4
   ```

3. **Consider browser-specific workflows** if resources are limited:
   ```yaml
   # Run Chrome tests
   - run: npx playwright test --project=chromium
   
   # Run Firefox tests
   - run: npx playwright test --project=firefox
   ```

## Summary

Multi-browser setup enables:
- ✅ Faster test execution through parallelization
- ✅ Comprehensive cross-browser coverage
- ✅ Early detection of browser-specific issues
- ✅ Flexible test execution options

**Quick Start:**
```bash
# Install all browsers
npx playwright install chromium msedge firefox webkit --with-deps

# Run tests across all browsers
npx playwright test
```
