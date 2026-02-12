import { defineConfig, devices } from '@playwright/test';
import { Status } from 'allure-js-commons';
import dotenv from 'dotenv'
import * as os from "node:os";
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: './global-setup',
  testDir: './tests',
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

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    // Capture screenshot after each test failure.
    screenshot: 'only-on-failure',

    // Record video only when test is failed, but remove all videos from successful test runs.
    video: 'retain-on-failure',

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
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--start-maximized']
        }
      },
    },

    // Temporarily disabled Firefox
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     launchOptions: {
    //       args: ['--start-maximized']
    //     }
    //   },
    // },

    // Temporarily disabled WebKit
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },
    
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        launchOptions: {
          args: ['--start-maximized']
        }
      },
    },
  ],
  expect: {
    // Maximum time expect() should wait for the condition to be met.
    timeout: 1000 * 60,
  }
});