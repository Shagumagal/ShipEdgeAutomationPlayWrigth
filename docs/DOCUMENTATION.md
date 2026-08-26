# 📦 ShipEdge Automation — Documentación Técnica

> Framework de automatización E2E para **Xenvio v2 (PrimeNG)** basado en Playwright + TypeScript.

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Arquitectura](#4-arquitectura)
5. [Configuración del Entorno](#5-configuración-del-entorno)
6. [Proyectos Playwright](#6-proyectos-playwright)
7. [Capa de Datos](#7-capa-de-datos)
8. [Page Objects v2](#8-page-objects-v2)
9. [Componentes Reutilizables](#9-componentes-reutilizables)
10. [Workflows](#10-workflows)
11. [Suite de Tests v2](#11-suite-de-tests-v2)
12. [Librerías Compartidas](#12-librerías-compartidas)
13. [Reportes](#13-reportes)
14. [Comandos de Ejecución](#14-comandos-de-ejecución)
15. [Convenciones y Buenas Prácticas](#15-convenciones-y-buenas-prácticas)

---

## 1. Descripción General

Este proyecto es el framework de automatización E2E de **ShipEdge / Xenvio**. Cubre los flujos principales del sistema de gestión de envíos: creación de órdenes, generación de etiquetas, configuración de carriers, envíos multi-caja, envíos internacionales, void de etiquetas, y más.

La arquitectura sigue el patrón **Page Object Model (POM)** con una capa adicional de **Workflows** que orquestan los flujos de negocio completos reutilizables entre tests.

| Versión | Framework UI | Proyecto Playwright |
|---------|-------------|---------------------|
| v1 (Legacy) | AngularMaterial (mat-*) | `msedge` |
| **v2 (Actual)** | **PrimeNG (p-button, p-accordion, etc.)** | **`xenvio-v2`** |

---

## 2. Stack Tecnológico

| Herramienta | Versión | Rol |
|-------------|---------|-----|
| Playwright | `^1.56.1` | Motor de automatización E2E |
| TypeScript | `^5.8.3` | Lenguaje principal |
| Allure Playwright | `^3.2.1` | Reportes visuales |
| @faker-js/faker | `^10.4.0` | Generación de datos de prueba |
| dotenv | `^17.2.0` | Gestión de variables de entorno |
| winston | `^3.19.0` | Logging estructurado |
| ESLint | `^9.26.0` | Calidad de código |

---

## 3. Estructura del Proyecto

```
ShipEdgeAutomationPlayWrigth/
│
├── v2/                              # Suite v2 — Xenvio PrimeNG (ACTIVA)
│   ├── tests/                       # Archivos .spec.ts (17 tests)
│   ├── page-objects/                # Page Objects v2
│   │   └── components/              # Componentes reutilizables
│   └── lib/                         # Workflows, fixtures y helpers de v2
│
├── v1/                              # Suite v1 — Legacy AngularMaterial
│   └── tests/
│
├── lib/                             # Librerías compartidas (ambas versiones)
│   ├── basepage.ts                  # Clase base con métodos Playwright comunes
│   ├── test-data.ts                 # Generadores de datos con Faker
│   ├── allure-helper.ts             # Helper para Allure
│   ├── test-failure-capture.ts      # Captura de evidencia en fallos
│   ├── helpers-fixtures.ts          # Fixtures globales de Playwright
│   ├── page-object-fixtures.ts      # Fixtures de page objects
│   ├── xenvio-workflows.ts          # Workflows legacy (v1)
│   └── logger.ts                    # Logger winston
│
├── data/                            # Datos de prueba en JSON
│   ├── carrier-configs.json         # Configuraciones de carriers (data-driven)
│   └── example-data.json
│
├── playwright.config.ts             # Configuración central de Playwright
├── package.json                     # Scripts y dependencias
├── tsconfig.json                    # Configuración TypeScript
├── .env.example                     # Plantilla de variables de entorno
└── docs/                            # Documentación
```

---

## 4. Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                    TEST SPECS                         │
│          (v2/tests/*.spec.ts — 17 tests)              │
└──────────────────────┬───────────────────────────────┘
                       │ usa
                       ▼
┌──────────────────────────────────────────────────────┐
│                    WORKFLOWS                          │
│          (v2/lib/xenvio-workflows.ts)                 │
│  Orquestan flujos de negocio completos.               │
│  Cada método estático = un paso Allure.               │
└──────────┬───────────────────────────────┬───────────┘
           │ instancia                     │ captura red
           ▼                               ▼
┌────────────────────┐       ┌─────────────────────────┐
│   PAGE OBJECTS      │       │    NETWORK INTERCEPT    │
│  (v2/page-objects/) │       │  Fetch monkey-patch     │
│  - LoginPage        │       │  task_executor capture  │
│  - DashboardPage    │       │  (label / void_label)   │
│  - NewOrderPage     │       └─────────────────────────┘
│  - OrderToLabelPage │
│  - CarrierConfigPage│
│  - BestRatePage     │
│  - ShipperViewPage  │
│  - CreateAppPage    │
│  - ShortcutsPage    │
└──────────┬──────────┘
           │ delega a
           ▼
┌──────────────────────────────────────────────────────┐
│                   COMPONENTES                         │
│          (v2/page-objects/components/)                │
│  - XenvioRatesModal                                   │
│  - XenvioBoxModal                                     │
│  - XenvioItemModal                                    │
│  - XenvioConfigureShipmentPanel                       │
│  - XenvioQCPackingModal                               │
│  - XenvioCarrierRestrictionDialogV2                   │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│                   BASE PAGE                           │
│               (lib/basepage.ts)                       │
│  click, type, waitFor, isVisible, getText...          │
└──────────────────────────────────────────────────────┘
```

### Patrón de captura de red (task_executor)

Varios tests necesitan capturar la respuesta del endpoint `task_executor`. Se usa un **fetch monkey-patch** inyectado en el contexto del browser antes de la acción:

```typescript
await popupPage.evaluate(() => {
    const origFetch = window.fetch;
    (window as any).__capturedResponse = null;
    window.fetch = async function (...args) {
        const response = await origFetch.apply(this, args);
        if (url.includes('task_executor') && response.ok) {
            (window as any).__capturedResponse = await response.clone().json();
        }
        return response;
    };
});

// Polling hasta recibir la respuesta
while (Date.now() - start < timeout) {
    result = await popupPage.evaluate(() => (window as any).__capturedResponse);
    if (result) break;
    await popupPage.waitForTimeout(1000);
}
```

> Este patrón es **inmune a la evicción del buffer CDP** y funciona correctamente en ventanas popup.

---

## 5. Configuración del Entorno

```bash
cp .env.example .env
```

### Variables requeridas para v2

| Variable | Descripción | Ejemplo |
|----------|------------|---------|
| `XENVIO_URL` | URL de login | `https://x5demo1.shipedge.com/users/sign_in` |
| `XENVIO_EMAIL` | Email del usuario de prueba | `test@send.com` |
| `XENVIO_PASSWORD` | Contraseña | `*****` |
| `APP_XENVIO` | Nombre de la aplicación | `AppQa20` |
| `WAREHOUSE_XENVIO` | Código del warehouse | `qa20` |
| `RETURN_LABEL_CARRIER` | Carrier para return label | `usps_qa20` |
| `RETURN_LABEL_SHIP_CODE` | Ship code para return label | `EUSEM` |
| `RESTRICTION_SHIP_CODE` | Ship code con restricción multibox | `EUSRPBB` |
| `CAPTURE_TRACE` | Grabar video/trace en todos los tests | `false` |

> **Nunca commitear el archivo `.env`.** Está incluido en `.gitignore`.

---

## 6. Proyectos Playwright

Definidos en `playwright.config.ts`:

| Proyecto | testDir | Browser | Uso |
|----------|---------|---------|-----|
| `msedge` | `./v1/tests` | Edge | Tests legacy (v1) |
| `xenvio-v2` | `./v2/tests` | Edge | Tests Xenvio PrimeNG — **ACTIVO** |

**Configuración global:**
- Timeout por test: **5 minutos**
- `actionTimeout`: 60 s / `navigationTimeout`: 60 s
- `viewport`: 1280×720 / `headless`: true
- Retries en CI: 2 / local: 0

---

## 7. Capa de Datos

### 7.1 Generadores de Datos (`lib/test-data.ts`)

Usa `@faker-js/faker` para datos únicos por ejecución:

| Función / Constante | Descripción |
|--------------------|------------|
| `generateUSRecipient()` | Destinatario US aleatorio (nombre, dirección, email, teléfono) |
| `generateProductDimensions()` | Dimensiones de paquete aleatorias |
| `StandardPackage` | 10×8×6 in, 5 lbs |
| `SmallPackage` | 5×4×3 in, 2 lbs |
| `DefaultReturnLabel` | Datos default para return label |
| `DefaultInternationalItem` | Ítem internacional por defecto (UK) |

```typescript
interface RecipientData {
    name: string; company?: string; email: string;
    phone?: string; address1: string; state: string;
    city: string; zip: string; country: string;
}

interface ProductDimensions {
    qty: string; length: string; width: string;
    height: string; weight: string;
}
```

### 7.2 Configuración de Carriers (`data/carrier-configs.json`)

Archivo JSON data-driven con todos los carriers soportados:

| ID | Carrier | Credenciales |
|----|---------|-------------|
| `usps` | USPS (ezUSPS) | Sin credenciales |
| `powership` | PowerShip | `client_id`, `client_secret`, `CustomerID`, `WarehouseID`, `OwnershipID` |
| `fedex` | FedEx (legacy) | `api_key`, `secret_key` |
| `ups` | UPS | `api_key`, `secret_key` |
| `ehub` | Ehub | `api_token` (campo único) |
| `speedee` | Spee-dee | `client_id`, `api_key` |
| `fedex_oauth_sandbox` | FedEx OAuth Sandbox | `Client id`, `SECRET KEY`, `Account` |
| `stamps_sandbox` | Stamps Sandbox | `access_token`, `refresh_token`, `State` |

---

## 8. Page Objects v2

Ubicados en `v2/page-objects/`. Todos extienden `BasePage`.

### `XenvioLoginPage`
| Método | Descripción |
|--------|------------|
| `navigateToLogin(url)` | Navega a la URL de login |
| `login(email, pass)` | Completa y envía el formulario de login |

### `XenvioDashboardPage`
| Método | Descripción |
|--------|------------|
| `openShipperView()` | Click en "Shipper View" → retorna la página popup |

### `XenvioShipperViewPage`
| Método | Descripción |
|--------|------------|
| `selectWarehouse(name)` | Selecciona warehouse en dropdown |
| `selectApplication(name)` | Selecciona la aplicación |
| `searchShipment(shipmentNumber)` | Busca un shipment por número |
| `waitForShipperViewReady()` | Espera a que la SPA esté cargada |

### `XenvioNewOrderPage`
| Método | Descripción |
|--------|------------|
| `createOrderFlow(recipient, pkg, warehouse)` | Flujo completo. Retorna shipment number |
| `fillRecipientInfo(recipient)` | Rellena datos del destinatario |
| `fillProductDimensions(pkg)` | Rellena dimensiones |
| `selectFulfillmentLocation(warehouse)` | Selecciona warehouse |
| `clickSaveOrder()` | Guarda y confirma la orden |

### `XenvioOrderToLabelPage`

La página más compleja. Gestiona el panel de detalle del shipment.

**Componentes delegados:**

| Propiedad | Componente | Rol |
|-----------|-----------|-----|
| `ratesModal` | `XenvioRatesModal` | Selección de tarifas |
| `qcModal` | `XenvioQCPackingModal` | Control de calidad |
| `boxModal` | `XenvioBoxModal` | Formulario de cajas |
| `itemModal` | `XenvioItemModal` | Formulario de ítems |
| `configPanel` | `XenvioConfigureShipmentPanel` | Panel de configuración |
| `carrierRestriction` | `XenvioCarrierRestrictionDialogV2` | Diálogo de restricción |

**Métodos principales:**

| Método | Descripción |
|--------|------------|
| `waitForShipmentDetailReady()` | Espera URL + botón GET RATES visible |
| `clickGetRates()` | Hace click en GET RATES y espera resultado |
| `clickSaveAndConfirm()` | Hace click en SAVE & CONFIRM |
| `clickGetLabels(timeoutMs)` | Genera etiquetas. Espera a que aparezca VOID SHIPPING LABELS |
| `clickVoidLabel()` | Click en VOID SHIPPING LABELS (activo cuando shipment = `shipped`) |
| `confirmVoidLabelDialog(timeoutMs)` | Confirma diálogo "Delete Shipment Label". Espera a que regrese GET LABELS |
| `expandShipmentPanel(shipmentId?)` | Expande el accordion del shipment |

> **Botones dinámicos:** El botón principal cambia según el estado del shipment:
> - `pending` → **GET LABELS**
> - `shipped` → **VOID SHIPPING LABELS**

### `XenvioCarrierConfigPage`
| Método | Descripción |
|--------|------------|
| `navigateToCarrierConfig()` | Navega a configuración de carriers |
| `searchAndSelectCarrier(name)` | Busca y selecciona un carrier |
| `fillDynamicField(label, value)` | Rellena campo de credencial dinámico |
| `saveCarrier()` | Guarda el carrier |
| `verifyCarrierCreated(name)` | Verifica que aparece en la tabla |

Soporta **single-field fallback** para carriers como Ehub (solo `api_token`).

### `XenvioBestRatePage`
| Método | Descripción |
|--------|------------|
| `createBestRate(name, carrier, codes[])` | Crea un Best Rate con shipping codes |
| `verifyBestRateCreated(name)` | Verifica que aparece en la tabla |

### `XenvioCreateAppPage`
| Método | Descripción |
|--------|------------|
| `createApp(name, webhookUrl)` | Crea una App con URL de webhook |
| `verifyAppCreated(name)` | Verifica que aparece en la tabla |

### `XenvioShortcutsPage`
| Método | Descripción |
|--------|------------|
| `openShortcutsModal()` | Abre el modal de atajos de teclado |
| `verifyShortcutsVisible()` | Verifica los atajos presentes |

### `XenvioPackingStationPage`
| Método | Descripción |
|--------|------------|
| `openPackingStationTab()` | Cambia al tab de Packing Station |
| `waitForBoxSelectionDialog()` | Espera el modal de "Select box type" |
| `selectFirstBoxType()` | Abre el dropdown de autocomplete y selecciona la primera caja |
| `confirmBoxSelection()` | Confirma la selección de tipo de caja |
| `selectAndConfirmBoxType()` | Flujo completo de selección y confirmación de caja |
| `scanAllItemsByClicking()` | Escanea todos los ítems de la barra lateral dando click a cada fila |
| `waitForCloseBoxDialog()` | Espera el modal "Close this box" |
| `applyCalculatedWeightAndClose()` | Aplica el peso calculado y sella la caja |
| `clickShipping()` | Hace click en "Shipping" para completar el empaquetado monobox |
| `verifyEndedBoxesCount(expected)` | Valida la cantidad de cajas finalizadas |

---

## 9. Componentes Reutilizables

Ubicados en `v2/page-objects/components/`.

### `XenvioRatesModal`
Modal de selección de tarifas (tras GET RATES).

| Método | Descripción |
|--------|------------|
| `waitForRatesLoaded(timeout)` | Espera a que las rate cards estén cargadas |
| `selectFirstRate(timeout)` | Selecciona la primera tarifa. Retorna su label |
| `selectRateByCarrier(carrier)` | Selecciona tarifa por nombre de carrier |

### `XenvioBoxModal`
DynamicDialog modal para cajas.

| Método | Descripción |
|--------|------------|
| `clickAddBox()` | Abre modal de nueva caja |
| `fillBoxForm(name, weight, length, width, height)` | Rellena formulario |
| `clickApplyBox()` | Guarda la caja |

### `XenvioItemModal`
DynamicDialog modal para ítems.

| Método | Descripción |
|--------|------------|
| `clickAddItem()` | Abre modal para la primera caja |
| `clickAddItemForBox(boxIndex)` | Abre modal para caja específica |
| `fillItemDetails(item)` | SKU, peso, dimensiones, precio, qty, país |
| `fillInternationalItemDetails(item)` | Versión extendida para ítems internacionales |
| `clickApplyItem()` | Guarda ítem y captura respuesta task_executor |

### `XenvioConfigureShipmentPanel`
Panel p-accordion de configuración.

| Método | Descripción |
|--------|------------|
| `selectCarrier(carrier)` | Selecciona carrier en dropdown |
| `selectShipCode(code)` | Selecciona ship code |
| `setReturnLabel(carrier, shipCode)` | Configura return label |

### `XenvioCarrierRestrictionDialogV2`
Diálogo de restricción multibox.

| Método | Descripción |
|--------|------------|
| `waitForDialog()` | Espera que aparezca el diálogo |
| `verifyMessage()` | Verifica mensaje de restricción |
| `close()` | Cierra el diálogo |

### `XenvioQCPackingModal`
Modal de Quality Control / Packing.

| Método | Descripción |
|--------|------------|
| `isVisible()` | Verifica si el modal QC está presente |
| `confirmPacking()` | Confirma el proceso de packing |

---

## 10. Workflows

`v2/lib/xenvio-workflows.ts` — Clase estática con flujos de negocio orquestados.
Cada método es un **Allure step** nombrado.

### Métodos disponibles

| Método | Descripción |
|--------|------------|
| `loginAndOpenShipperView(loginPage, dashboard, config)` | Login + apertura del popup Shipper View |
| `createStandardOrder(page, recipient, pkg, warehouse)` | Flujo de creación de orden. Retorna shipment number |
| `waitForShipmentDetailAfterCreation(page, shipmentNumber)` | Espera auto-redirect al detalle |
| `searchAndOpenShipment(page, shipmentNumber, config?)` | Busca y abre un shipment existente |
| `addItemDetails(orderPage, itemData)` | Agrega ítem y captura respuesta task_executor |
| `getLabelsAndCaptureResult(page, orderPage, timeoutMs)` | GET LABELS + captura de respuesta de red |
| `voidLabelAndCaptureResult(page, orderPage, timeoutMs)` | VOID LABEL + confirmación + captura de respuesta |
| `createMultiBoxOrder(...)` | Orden multi-caja (N cajas con ítems) |
| `createInternationalOrder(...)` | Orden internacional con datos de aduana |
| `configureReturnLabel(...)` | Configuración de return label |

### Retorno de `getLabelsAndCaptureResult`

```typescript
{
    finalPostage: number | null,    // Costo final de la etiqueta
    shippingCost: number | null,    // Costo de envío
    labelUrls: string[],            // URLs de etiquetas PDF
    docUrls: string[],              // URLs de documentos
    shipmentState: string | null,   // 'shipped'
    shipmentNumber: string | null,
    orderNumber: string | null,
    labelsByBox: [{
        boxIndex: number,
        trackingNumber: string | null,
        state: string | null,       // 'shipped'
        label: string | null,       // URL del PDF de la caja
    }]
}
```

### Retorno de `voidLabelAndCaptureResult`

```typescript
{
    shipmentState: string | null,  // 'voided'
    labelState: string | null,     // 'void' (de box.labelState)
    shipmentNumber: string | null,
    orderNumber: string | null,
    boxesVoidState: [{
        boxIndex: number,
        state: string | null,       // 'voided' (box.aasmState)
        trackingNumber: string | null,
        labelState: string | null,  // 'void' (box.labelState)
    }]
}
```

### Estados del API por operación

| Operación | `shipment.aasmState` | `box.aasmState` | `box.labelState` |
|-----------|---------------------|-----------------|-----------------|
| GET LABELS | `shipped` | `shipped` | `label` |
| VOID LABEL | `voided` | `voided` | `void` |

---

## 11. Suite de Tests v2

17 tests en `v2/tests/`. Todos corren bajo el proyecto `xenvio-v2`.

### Órdenes

| Archivo | ID | Descripción |
|---------|----|------------|
| `xenvio-new-order.spec.ts` | TC-Xenvio-NewOrder-001 | Crear orden doméstica US (datos aleatorios) |
| `xenvio-new-order-multibox.spec.ts` | TC-Xenvio-NewOrder-MultiBox | Crear orden con 3 cajas |

### Order-to-Label

| Archivo | ID | Descripción |
|---------|----|------------|
| `xenvio-order-to-label.spec.ts` | TC-Xenvio-O2L-001 | Flujo completo: crear orden → label |
| `xenvio-order-to-label-multibox.spec.ts` | TC-Xenvio-O2L-MultiBox | Multi-caja (3 cajas) + verificar shipped/tracking |
| `xenvio-order-to-label-batch.spec.ts` | TC-Xenvio-O2L-Batch | Generación de labels en lote |
| `xenvio-void-label.spec.ts` | TC-Xenvio-VoidLabel-001 | Crear orden → label → void → verificar voided |

### Internacionales

| Archivo | ID | Descripción |
|---------|----|------------|
| `xenvio-shipper-view-order-international.spec.ts` | TC-Xenvio-Intl-001 | Orden internacional (UK) — 1 caja |
| `xenvio-shipper-view-order-international-multibox.spec.ts` | TC-Xenvio-Intl-MultiBox-001 | Orden internacional (UK) — 3 cajas |
| `xenvio-include-return-label.spec.ts` | TC-Xenvio-RL-001 | Orden con return label incluido |

### Carriers

| Archivo | ID | Descripción |
|---------|----|------------|
| `xenvio-carrier-configuration.spec.ts` | TC-Xenvio-Carrier-001 | Creación manual de USPS + shipping codes |
| `xenvio-carrier-data-driven.spec.ts` | TC-Xenvio-Carrier-DD | Data-driven: crea todos los carriers del JSON |
| `xenvio-multibox-carrier-restriction.spec.ts` | TC-Xenvio-MultiBox-Restriction-001 | Verifica diálogo de restricción (ezUSPS) |

### Configuración

| Archivo | ID | Descripción |
|---------|----|------------|
| `xenvio-shipper-new-best-rate.spec.ts` | TC-Xenvio-BestRate-001 | Creación de Best Rate con shipping codes |
| `xenvio-shipper-view-create-app.spec.ts` | TC-Xenvio-CreateApp-001 | Creación de App con webhook URL |

### UI / Funcionalidad

| Archivo | ID | Descripción |
|---------|----|------------|
| `xenvio-shipper-view.spec.ts` | TC-Xenvio-ShipperView | Smoke: login + formulario Shipper View |
| `xenvio-order-get-rates.spec.ts` | TC-Xenvio-GR-001 | Crear orden + verificar carga de tarifas |
| `xenvio-shortcuts.spec.ts` | TC-Xenvio-Shortcuts | Verificar modal de atajos de teclado |
| `xenvio-packing-station-monobox.spec.ts` | TC-Xenvio-PackingStation-001 | Packing Station: empaquetado monobox de orden con 3 ítems → Shipping |

---

## 12. Librerías Compartidas

### `lib/basepage.ts`

Clase abstracta base para todos los Page Objects.

| Método | Descripción |
|--------|------------|
| `click(locator, waitForPageLoad?)` | Click con focus previo |
| `type(locator, text)` | Limpia y rellena un campo |
| `waitForElementToBeVisible(locator, timeout?)` | Espera visibilidad |
| `waitForElementToBeHidden(locator, timeout?)` | Espera ocultamiento |
| `isElementVisible(locator, timeout?)` | Verifica visibilidad sin lanzar error |
| `getText(locator)` | Obtiene innerText |
| `getAttribute(locator, attr)` | Obtiene atributo HTML |
| `waitForXenvioLoading(timeout?)` | Espera a que el spinner desaparezca |

### `lib/test-failure-capture.ts`

Captura automática al fallar un test:
- Screenshot de la página
- Logs de consola del browser
- Trace de Playwright

### `lib/allure-helper.ts`

| Método | Descripción |
|--------|------------|
| `applyTestMetadata(opts)` | Asigna owner, tags, severity, epic, feature, story |
| `attachScreenShot(page)` | Adjunta screenshot al reporte Allure |

### `lib/logger.ts`

Logger winston con niveles `info`, `warn`, `error`.

---

## 13. Reportes

| Reporte | Comando | Descripción |
|---------|---------|------------|
| **HTML Playwright** | `npx playwright show-report` | Reporte nativo con traces, videos, snapshots |
| **Allure** | `npm run allure:generate && npm run allure:open` | Reporte visual con steps y metadata |
| **List** | (consola) | Output en tiempo real |

```bash
# Generar y abrir Allure
npm run allure:generate
npm run allure:open

# Limpiar resultados anteriores
npm run clean
```

---

## 14. Comandos de Ejecución

```bash
# Todos los tests v2
npm run test:v2

# Test específico (headed)
npx playwright test xenvio-void-label --project=xenvio-v2 --headed

# Por nombre (grep)
npx playwright test --project=xenvio-v2 -g "TC-Xenvio-VoidLabel"

# Modo debug (Playwright Inspector)
npx playwright test xenvio-order-to-label --project=xenvio-v2 --debug

# Listar todos los tests
npx playwright test --project=xenvio-v2 --list

# Carrier data-driven — solo un carrier
npx playwright test xenvio-carrier-data-driven --project=xenvio-v2 -g "Ehub" --headed

# Con tracing completo
CAPTURE_TRACE=true npx playwright test --project=xenvio-v2
```

---

## 15. Convenciones y Buenas Prácticas

### Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------| 
| Archivos de test | `xenvio-<feature>.spec.ts` | `xenvio-void-label.spec.ts` |
| Page Objects | `Xenvio<Page>Page` | `XenvioOrderToLabelPage` |
| Componentes | `Xenvio<Component>` | `XenvioRatesModal` |
| IDs de test | `TC-Xenvio-<Feature>-<NNN>` | `TC-Xenvio-VoidLabel-001` |
| IDs data-driven | `TC-Xenvio-<Feature>-DD` | `TC-Xenvio-Carrier-DD` |

### Reglas

1. **Variables sensibles nunca van en el código** — leer de `process.env.*`.
2. **No usar `waitForTimeout()` como estrategia principal** — usar `waitFor`, `expect`, o `waitForURL`.
3. **Todos los tests incluyen metadata Allure** (`owner`, `tags`, `severity`, `epic`, `feature`, `story`).
4. **Los page objects solo se instancian en Workflows** para flujos multi-paso.
5. **Screenshot después de cada paso significativo** con `AllureHelper.attachScreenShot()`.
6. **Datos de prueba aleatorios** — usar `generateUSRecipient()` para evitar conflictos entre runs.
7. **El interceptor de fetch se limpia en `finally`** para no contaminar tests posteriores.
8. **Usar `getByRole` en diálogos** — Angular renderiza whitespace alrededor del texto interpolado.
9. **Scopear locators de diálogos dentro de su contenedor** (`mat-dialog-container`) para evitar falsos positivos.

### Estructura de un test

```typescript
test('TC-Xenvio-Feature-001: descripción', async ({ xenvioLoginPage, xenvioDashboardPage }) => {

    // 1. Metadata Allure
    await AllureHelper.applyTestMetadata({ ... });

    // 2. Config desde env
    const config = { url: process.env.XENVIO_URL!, ... };

    // 3. Workflows
    const popupPage = await XenvioWorkflows.loginAndOpenShipperView(...);
    const shipmentNumber = await XenvioWorkflows.createStandardOrder(...);
    const orderPage = await XenvioWorkflows.waitForShipmentDetailAfterCreation(...);

    // 4. Pasos específicos
    await test.step('N. Descripción', async () => {
        // acción
        await AllureHelper.attachScreenShot(popupPage);
    });

    // 5. Assertions
    expect(result).toBe(expected);
});

// 6. Captura de fallos
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        await captureTestFailure(page, testInfo, new Error(...));
    }
});
```

---

*Documentación generada: 2026-08-24 | Versión del sistema: xe26.03.0-rc*
