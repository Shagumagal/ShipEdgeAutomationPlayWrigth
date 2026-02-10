# Project Setup

This document provides step-by-step instructions for setting up the project locally.

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js** - Version LTS (Long Term Support) recommended
- **npm** - Comes with Node.js
- **Git** - For version control

### Verify Installation

```bash
node --version
npm --version
git --version
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd playwright-template-project
```

### 2. Install Dependencies

Install all project dependencies:

```bash
npm install
```

This installs:
- Playwright and browser binaries
- TypeScript and type definitions
- Allure reporting tools
- Test management platform CLI (optional)
- Other project dependencies

### 3. Install Playwright Browsers

#### Basic Installation (Chrome Only)

For quick setup or if you only need Chrome:

```bash
npx playwright install chromium --with-deps
```

#### Multi-Browser Installation (Recommended for Parallel Execution)

To enable parallel test execution across multiple browsers, install all supported browsers:

```bash
npx playwright install chromium msedge firefox webkit --with-deps
```

This installs:
- **Chromium** (Chrome) - Default browser
- **Microsoft Edge** - For Edge-specific testing
- **Firefox** - For Firefox-specific testing
- **WebKit** (Safari) - For Safari/WebKit testing

**Note**: The `--with-deps` flag installs system dependencies required for browsers.

#### Installing Individual Browsers

You can also install browsers individually:

```bash
# Install Chrome/Chromium
npx playwright install chromium --with-deps

# Install Microsoft Edge
npx playwright install msedge --with-deps

# Install Firefox
npx playwright install firefox --with-deps

# Install WebKit (Safari)
npx playwright install webkit --with-deps
```

#### Why Install Multiple Browsers?

Installing multiple browsers enables:

1. **Parallel Test Execution**: Run tests simultaneously across different browsers
   ```bash
   # Run all tests on all browsers in parallel
   npx playwright test
   ```

2. **Cross-Browser Testing**: Verify your application works across different browser engines
   - Chromium (Blink engine)
   - Firefox (Gecko engine)
   - WebKit (WebKit engine)

3. **Browser-Specific Test Execution**: Run tests on specific browsers
   ```bash
   npm run test:smoke-chrome   # Chrome only
   npm run test:smoke-edge     # Edge only
   npm run test:smoke-firefox  # Firefox only
   npm run test:smoke-safari   # Safari/WebKit only
   ```

4. **Faster Test Execution**: With parallel execution, tests run faster across multiple browsers simultaneously

**Recommendation**: Install all browsers during initial setup to enable full parallel execution capabilities.

### 4. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env  # If example exists
# Or create .env manually
```

Add required environment variables (see [Configuration](02-configuration.md) for details):

```bash
# Test Management Platform Configuration (Optional)
# If using a test management platform, add your configuration here
# TEST_MANAGEMENT_API_TOKEN=your-api-token

# Application Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123

# Additional user credentials (if needed for your application)
# ADMIN_USER_EMAIL=admin@example.com
# ADMIN_USER_PASSWORD=admin-password
```

**Important**: Never commit `.env` files to version control. Ensure `.env` is in `.gitignore`.

### 5. Verify Installation

Run a simple test to verify everything is set up correctly:

```bash
npm run test:smoke-chrome
```

## Dependencies Overview

### Core Dependencies

- **@playwright/test** - Playwright testing framework
- **typescript** - TypeScript compiler
- **dotenv** - Environment variable management

### Testing and Reporting

- **allure-playwright** - Allure reporter for Playwright
- **allure-commandline** - Allure CLI tools
- **allure-js-commons** - Allure JavaScript common utilities


### Test Data

- **@faker-js/faker** - Fake data generation for tests

### Utilities

- **adm-zip** - ZIP file creation for packaging

### Development Dependencies

- **@types/node** - TypeScript definitions for Node.js
- **eslint** - Code linting
- **typescript-eslint** - TypeScript ESLint plugin

## NPM Scripts Reference

### Test Execution Scripts

#### Run Tests on Specific Browsers

```bash
# Chrome
npm run test:smoke-chrome

# Edge
npm run test:smoke-edge

# Safari/WebKit
npm run test:smoke-safari

# Firefox
npm run test:smoke-firefox
```

All smoke test scripts:
- Run with 1 worker (sequential execution)
- No retries
- Generate HTML, line, and Allure reports

#### Run Regression Tests

```bash
npm run test:regression
```

Runs all tests on Chromium with:
- 1 worker
- Retries enabled (2 retries on CI)
- All reporters enabled

### Reporting Scripts

#### Generate Allure Report

```bash
npm run allure:generate
```

Generates HTML report from `allure-results/` directory:
- Output: `allure-report/`
- Preserves history from previous runs
- Cleans previous report before generating

#### Open Allure Report

```bash
npm run allure:open
```

Opens the generated Allure report in your browser.

### Code Quality Scripts

#### Lint Code

```bash
# Lint all TypeScript files
npm run lint

# Lint only test-related files (tests, page-objects, lib)
npm run lint:tests
```

Lints TypeScript files using ESLint:
- Fixes auto-fixable issues
- Uses TypeScript ESLint rules
- Checks all `.ts` files (excluding config files and generated directories)

### Packaging Scripts

#### Package for Desktop

```bash
npm run package:desktop
```

Creates a ZIP package of the project:
- Excludes `node_modules`, `.idea`, `allure-results`, `allure-report`, `.git`
- Includes timestamp in filename
- Output: `tests-{timestamp}.zip`

#### Package for CI/CD

```bash
npm run package:desktop
```

Similar to `package:desktop` but optimized for CI/CD environments.

## Project Structure

After installation, your project structure should look like:

```
playwright-template-project/
├── .env                    # Environment variables (create this)
├── .github/                 # GitHub Actions workflows
├── allure-report/           # Generated Allure reports
├── allure-results/          # Allure test results
├── data/                    # Test data and constants
├── docs/                    # Documentation
├── lib/                     # Utilities and base classes
├── page-objects/            # Page Object Model classes
├── playwright-report/       # Playwright HTML reports
├── test-results/            # Test execution artifacts
├── tests/                   # Test specifications
├── package.json             # Project dependencies
├── playwright.config.ts     # Playwright configuration
└── playwright.service.config.ts  # Service configuration
```

## First Test Run

### 1. Run a Single Test

Run a specific test file:

```bash
npx playwright test tests/example-login.spec.ts
```

### 2. Run All Tests

Run all tests:

```bash
npm run test:regression
```

### 3. View Results

After running tests:

1. **Playwright Report**: Open `playwright-report/index.html`
2. **Allure Report**: 
   ```bash
   npm run allure:generate
   npm run allure:open
   ```

## Environment Setup Details

### Node.js Version

The project uses Node.js LTS version. Check `.nvmrc` or `package.json` for the recommended version.

### TypeScript Configuration

TypeScript is configured through `tsconfig.json` (if present) or Playwright's default configuration.

### Browser Installation

Browsers are installed in the Playwright cache directory (typically `~/.cache/ms-playwright/` on Linux/Mac).

### Environment Variables

Environment variables are loaded using `dotenv` in:
- `playwright.config.ts`
- `playwright.service.config.ts`
- `global-setup.ts`

## Troubleshooting

### Common Issues

#### 1. Browser Installation Fails

**Problem**: `npx playwright install` fails

**Solution**:
- Install system dependencies manually
- On Ubuntu/Debian: `sudo apt-get install -y libnss3 libatk1.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2`
- On macOS: Usually works automatically
- On Windows: Usually works automatically

#### 2. Environment Variables Not Loading

**Problem**: Tests fail with "undefined" environment variables

**Solution**:
- Ensure `.env` file exists in project root
- Check that `.env` file has correct variable names
- Verify `dotenv` is loading the file correctly

#### 3. TypeScript Errors

**Problem**: TypeScript compilation errors

**Solution**:
- Run `npm install` to ensure all dependencies are installed
- Check TypeScript version compatibility
- Verify `tsconfig.json` configuration

#### 4. Allure Report Not Generating

**Problem**: `allure:generate` fails

**Solution**:
- Ensure `allure-results/` directory exists
- Check that tests have run and generated results
- Verify Allure CLI is installed: `npm list allure-commandline`

#### 5. Tests Timeout

**Problem**: Tests fail with timeout errors

**Solution**:
- Check network connectivity
- Verify base URL is accessible
- Increase timeout in `playwright.config.ts` if needed
- Check if application is running and accessible

## Next Steps

After setup:

1. **Read Documentation**: Start with [Architecture Overview](01-architecture-overview.md)
2. **Write Your First Test**: Follow [Test Development](03-test-development.md) guide
3. **Create Page Objects**: See [Page Objects](04-page-objects.md) documentation
4. **Configure CI/CD**: Set up [CI/CD Integration](05-ci-cd-integration.md)

## Related Documentation

- [Configuration](02-configuration.md) - Detailed configuration guide
- [Architecture Overview](01-architecture-overview.md) - Project structure
- [Test Development](03-test-development.md) - Writing tests


















