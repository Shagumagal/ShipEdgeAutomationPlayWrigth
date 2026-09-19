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
        // Categorías por CAUSA del fallo, no por estado.
        // Objetivo: que QA distinga de un vistazo "falló el sistema" de
        // "falló la automatización" o "falló el ambiente".
        // Para agregar una categoría nueva: sumá un objeto con messageRegex.
        // Nota: un fallo puede aparecer en más de una categoría si coincide
        // con varios patrones; la última ("Otros fallos") es una red de
        // seguridad para que ningún fallo quede invisible en el reporte.
        categories: [
          // ── Ambiente / configuración (no son defectos del producto) ──
          {
            name: 'Configuración de ambiente faltante',
            description: 'Falta o está vacía una variable requerida en .env (ver v2/config/xenvio-config.ts).',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*Missing required Xenvio environment variables.*',
          },
          {
            name: 'Autenticación / sesión',
            description: 'Login rechazado, sesión expirada o acceso no autorizado.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*(Unauthorized|Forbidden|\\b401\\b|\\b403\\b|Invalid (email|credentials|password)).*',
          },
          {
            name: 'Error de API / backend',
            description: 'Respuesta 5xx, request fallido o error de red contra el backend.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*(net::ERR|ECONNREFUSED|ECONNRESET|socket hang up|Internal Server Error|Bad Gateway|Service Unavailable|\\b50[0-4]\\b).*',
          },

          // ── Problemas de la automatización, no del producto ──
          {
            name: 'Selector desactualizado / elemento no encontrado',
            description: 'El locator no existe, cambió en la UI, o coincide con varios elementos (strict mode).',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*(waiting for locator|strict mode violation|element is not attached|no element matches|not visible).*',
          },
          {
            name: 'Timeout de navegación o carga',
            description: 'Una navegación o carga de página no terminó dentro del tiempo permitido.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*(page\\.goto|waitForURL|waitForLoadState|Navigation timeout|networkidle).*',
          },
          {
            name: 'Timeout de test',
            description: 'El test excedió el timeout global configurado en playwright.config.ts.',
            matchedStatuses: [Status.FAILED, Status.BROKEN],
            messageRegex: '(?s).*Test timeout of .* exceeded.*',
          },

          // ── Posible defecto funcional del producto ──
          {
            name: 'Defecto funcional (assertion)',
            description: 'Una aserción de negocio falló: el sistema devolvió algo distinto a lo esperado.',
            matchedStatuses: [Status.FAILED],
            messageRegex: '(?s).*(expect\\(|Expected:|Received:).*',
          },

          // ── Red de seguridad ──
          // A propósito es un SUPERCONJUNTO: acá aparecen todos los fallos,
          // incluidos los que ya salieron en una categoría específica arriba.
          // Sirve para detectar fallos de un tipo nuevo que todavía no tiene
          // categoría propia (aparecen solo acá y en ningún otro lado).
          // Si preferís una vista de triage sin repetidos, borrá este objeto.
          {
            name: 'Todos los fallos (vista completa)',
            description: 'Superconjunto intencional: incluye todos los fallos. Si uno aparece SOLO acá, es un tipo de fallo sin categoría propia todavía.',
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

    // Capture screenshot after each test
    screenshot: process.env.CAPTURE_TRACE === 'true' ? 'on' : 'only-on-failure',

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

    {
      name: 'msedge',
      testDir: './v1/tests',
      use: {
        ...devices['Desktop Edge'],
        launchOptions: {
          args: ['--start-maximized']
        }
      },
    },

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
  ],
  expect: {
    // Maximum time expect() should wait for the condition to be met.
    timeout: 1000 * 60,
  }
});
