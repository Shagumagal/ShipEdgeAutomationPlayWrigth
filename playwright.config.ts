import { defineConfig, devices } from '@playwright/test';
import { Status } from 'allure-js-commons';
import dotenv from 'dotenv'
import * as os from "node:os";
import path from 'path';
import { CARRIER_FAILURE_TAG_PATTERN } from './v2/diagnostics/carrier-failure-report';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Allure category regex that ignores failures tagged [EXTERNAL CARRIER], so they only show
 * up under "External carrier error" (e.g. a carrier 401 is not a Xenvio login problem).
 * Use it in every new specific category.
 */
const excludeCarrier = (pattern: string) => `(?s)(?!${CARRIER_FAILURE_TAG_PATTERN})${pattern}`;
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: './global-setup',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  // Retries allow tests to run again if they fail. Useful for flaky tests.
  // Example: retries: 2, // retry twice
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // IMPORTANT! Allure Results generation is requirement for displaying results on Testlio platform.
  // Don't disable Allure Results if not necessary to do so.
  reporter: [
    ['list'],
    ['html'],
    [
      'allure-playwright',
      {
        detail: false,
        resultsDir: 'allure-results',
        // Categories by CAUSE of the failure, not by status, so QA can tell at a glance
        // "the product failed" from "the automation failed" or "the environment failed".
        // To add a category: append an object with its messageRegex.
        // A failure can match more than one category; the last one ("All failures") is a
        // safety net so no failure stays invisible in the report.
        categories: [
          // ── Environment / configuration (not product defects) ──
          {
            name: 'Missing environment configuration',
            description: 'A required variable is missing or empty in .env (see v2/config/xenvio-config.ts).',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*Missing required Xenvio environment variables.*',
          },
          // ── External carrier (EasyPost, FedEx, UPS, PowerShip, ...) ──
          // The carrierDiagnostics fixture prefixes the error with [EXTERNAL CARRIER] only
          // when the carrier rejected the operation, or when there were no rates because of
          // carrier errors (see v2/diagnostics/). The categories below use excludeCarrier()
          // so those failures are not listed twice.
          {
            name: 'External carrier error',
            description: 'The carrier (EasyPost, FedEx, UPS, PowerShip, ...) rejected the operation or returned no rates. The detail is in the "Carrier errors (View Requests)" attachment.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: `(?s)${CARRIER_FAILURE_TAG_PATTERN}.*`,
          },
          {
            name: 'Authentication / session',
            description: 'Login rejected, session expired or unauthorized access.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: excludeCarrier('.*(Unauthorized|Forbidden|\\b401\\b|\\b403\\b|Invalid (email|credentials|password)).*'),
          },
          {
            name: 'API / backend error',
            description: '5xx response, failed request or network error against the backend.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: excludeCarrier('.*(net::ERR|ECONNREFUSED|ECONNRESET|socket hang up|Internal Server Error|Bad Gateway|Service Unavailable|\\b50[0-4]\\b).*'),
          },

          // ── Automation problems, not product defects ──
          {
            name: 'Stale selector / element not found',
            description: 'The locator does not exist, changed in the UI, or matches several elements (strict mode).',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: excludeCarrier('.*(waiting for locator|strict mode violation|element is not attached|no element matches|not visible).*'),
          },
          {
            name: 'Navigation or load timeout',
            description: 'A navigation or page load did not finish within the allowed time.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: excludeCarrier('.*(page\\.goto|waitForURL|waitForLoadState|Navigation timeout|networkidle).*'),
          },
          {
            name: 'Test timeout',
            description: 'The test exceeded the global timeout configured in playwright.config.ts.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: excludeCarrier('.*Test timeout of .* exceeded.*'),
          },

          // ── Possible product defect ──
          {
            name: 'Functional defect (assertion)',
            description: 'A business assertion failed: the system returned something different from what was expected.',
            matchedStatuses: [Status.FAILED],
            messageRegex: excludeCarrier('.*(expect\\(|Expected:|Received:).*'),
          },

          // ── Safety net ──
          // Intentionally a SUPERSET: every failure shows up here, including the ones
          // already listed in a specific category above. It surfaces a new kind of failure
          // that has no category yet (it would appear only here).
          // Delete this object for a triage view without repeats.
          {
            name: 'All failures (full view)',
            description: 'Intentional superset: it includes every failure. If one appears ONLY here, it is a kind of failure without its own category yet.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
          },
        ],
        environmentInfo: {
          Xenvio_URL: process.env.XENVIO_URL || 'N/A',
          Core_URL: process.env.BASE_URL || 'N/A',
          Environment: process.env.ENV_NAME || 'QA',
          os_platform: os.platform(),
          os_release: os.release(),
          os_version: os.version(),
          node_version: process.version,
        },
      },
    ],
  ],
  // Each test is given 5 minutes maximum time
  // This is the maximum time a test can run before it is stopped.
  // Value is in milliseconds (1000 ms = 1 second).
  // Example: timeout: 30 * 1000, // 30 seconds
  timeout: 5 * 60 * 1000,

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // IMPORTANT! Make sure to replace the base URL value for your project's app URL.
    // You can also use environment variables: baseURL: process.env.BASE_URL || 'https://example.com',
    baseURL: process.env.BASE_URL || 'https://qa8.shipedge.com',
    launchOptions: {
      slowMo: 100  // Slows down operations by 100ms for debugging. Remove or set to 0 for faster execution.
    },
    // Headless mode
    headless: true,
    // Action timeout waiting for element to be click()
    actionTimeout: 1000 * 60,

    /* Collect trace based on environment variable. Contains DOM snapshots, network, and console logs. */
    trace: process.env.CAPTURE_TRACE === 'true' ? 'on' : 'retain-on-failure',

    // Failure screenshots are taken by v2/diagnostics/test-failure-capture.ts (full page,
    // every tab, with an explicit name), so they are not duplicated in the report.
    screenshot: process.env.CAPTURE_TRACE === 'true' ? 'on' : 'off',

    // Record video
    video: process.env.CAPTURE_TRACE === 'true' ? 'on' : 'retain-on-failure',

    // Permissions for browser
    permissions: ['notifications'],

    // navigation timeout between pages
    navigationTimeout: 1000 * 60,

    // Custom data attribute for test IDs
    // Update this value to match your application's test ID attribute (e.g., "data-testid", "data-qa", "testid")
    // If your app doesn't use test IDs, you can remove this line
    testIdAttribute: process.env.TEST_ID_ATTRIBUTE || "data-testid",

    // Timezone setting
    // This is required for time-sensitive functionalities to ensure consistent behavior
    // across different running environments and local setups, preventing issues caused by timezone discrepancies.
    // Update this to match your application's timezone
    timezoneId: process.env.TIMEZONE || "America/New_York",

    // Defining common viewport size for Azure instances and local runs
    viewport: { width: 1280, height: 720 },
  },

  /* Configure projects for major browsers */
  projects: [
    /*
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--start-maximized', '--no-sandbox']
        }
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          args: ['--start-maximized']
        }
      },
    },
    */

    // ─── Xenvio v2 (PrimeNG) ──────────────────────────────────────
    {
      name: 'xenvio-v2',
      testDir: './v2/tests',
      use: {
        ...devices['Desktop Edge'],
        launchOptions: {
          args: ['--start-maximized']
        }
      },
    },

    // ─── Unit tests (no browser) ──────────────────────────────────
    // Pure logic only: parsers, builders, validations. No browser, no QA environment,
    // and they run in seconds: npm run test:unit
    {
      name: 'unit',
      testDir: './v2/unit',
      testMatch: /.*\.unit\.spec\.ts$/,
    },
  ],
  expect: {
    // Maximum time expect() should wait for the condition to be met.
    timeout: 1000 * 60,
  }
});
