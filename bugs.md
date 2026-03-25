# 📋 Plan de QA — Shipping Method Config en Shipments

**Proyecto:** Xenvio / ShipEdge  
**Fecha:** 2026-03-19  
**Autor:** QA Automation Team  
**Objetivo:** Validar que shipments con `shipping_method_config` asignado muestren correctamente los datos de carrier, método y mail type según el rol del usuario.

---

## 📊 Resumen de Suites

| Suite | Test Cases | Qué valida |
| :--- | :--- | :--- |
| 1. Fix Principal | TC-001, TC-002 | Shipments con `shipping_method_config` muestran datos correctos como `warehouse_manager` y `regular_user` |
| 2. Regresión | TC-003, TC-004 | Flujo de custom shipping (selección manual de carrier en shipper-view) sigue funcionando; valores del meta tienen prioridad sobre el fallback |
| 3. Edge Cases | TC-005 a TC-008 | Sin config ni meta (no error 500), config sin `mail_type`, shipments `shipped`, shipments `voided` |
| 4. API | TC-009, TC-010 | Shipments creados vía API con y sin shipping method |
| 5. Roles | TC-011, TC-012 | Regresión del admin, múltiples shipments en un resultado |

---

## 🎯 Criterios Mínimos para Sign-off

> **Obligatorios para aprobar:** TC-001, TC-002, TC-003, TC-005, TC-009 y TC-011.  
> Si todos los obligatorios pasan, el ticket es **apto para sign-off**.

---

## Suite 1: Fix Principal

### TC-001 — Shipment con `shipping_method_config` como `warehouse_manager`

**Prioridad:** 🔴 Crítica  
**Precondición:** Shipment existente con `shipping_method_config` asignado, usuario con rol `warehouse_manager`.

**Pasos:**

1. Iniciar sesión como `warehouse_manager`
2. Navegar a la vista de shipments
3. Abrir el shipment que tiene `shipping_method_config` asignado
4. Verificar que se muestren los datos de shipping

**Validaciones:**

- [ ] El carrier se muestra correctamente (ej: USPS, FedEx, UPS)
- [ ] El ship method se muestra con el nombre correcto
- [ ] El `mail_type` se muestra según la configuración asignada
- [ ] No se muestra error 500 ni campos vacíos
- [ ] Los datos coinciden con los valores almacenados en `shipping_method_config`

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-002 — Shipment con `shipping_method_config` como `regular_user`

**Prioridad:** 🔴 Crítica  
**Precondición:** Mismo shipment del TC-001, usuario con rol `regular_user`.

**Pasos:**

1. Iniciar sesión como `regular_user`
2. Navegar a la vista de shipments
3. Abrir el mismo shipment del TC-001
4. Verificar que se muestren los datos de shipping

**Validaciones:**

- [ ] El carrier se muestra correctamente
- [ ] El ship method se muestra con el nombre correcto
- [ ] El `mail_type` se muestra según la configuración
- [ ] Los datos son consistentes con lo que ve el `warehouse_manager` (TC-001)
- [ ] No hay diferencias de permisos inesperadas en la visualización

**Resultado:** ☐ Pass | ☐ Fail

---

## Suite 2: Regresión

### TC-003 — Flujo de Custom Shipping (selección manual en shipper-view)

**Prioridad:** 🔴 Crítica  
**Precondición:** Usuario con acceso a shipper-view, carrier configurado manualmente.

**Pasos:**

1. Iniciar sesión y navegar al shipper-view
2. Crear un nuevo shipment o editar uno existente
3. Seleccionar el carrier manualmente desde el dropdown
4. Seleccionar el ship method manualmente
5. Guardar el shipment

**Validaciones:**

- [ ] El dropdown de carriers carga correctamente
- [ ] Los ship methods se filtran por el carrier seleccionado
- [ ] Al guardar, el shipment almacena la configuración custom correctamente
- [ ] Al reabrir el shipment, los valores seleccionados persisten
- [ ] El flujo manual no se ve afectado por el fix de `shipping_method_config`

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-004 — Valores del meta tienen prioridad sobre el fallback

**Prioridad:** 🟡 Media  
**Precondición:** Shipment con valores tanto en meta como en fallback/config.

**Pasos:**

1. Identificar un shipment que tenga valores en los campos meta Y en `shipping_method_config`
2. Abrir el shipment en la vista de detalle
3. Verificar qué valores se muestran

**Validaciones:**

- [ ] Los valores del meta se muestran con prioridad sobre los del fallback
- [ ] Si el meta tiene carrier "FedEx" y el config tiene "USPS", se muestra "FedEx"
- [ ] El `mail_type` del meta prevalece sobre el del config
- [ ] La lógica de priorización no genera errores

**Resultado:** ☐ Pass | ☐ Fail

---

## Suite 3: Edge Cases

### TC-005 — Shipment sin config ni meta (no error 500)

**Prioridad:** 🔴 Crítica  
**Precondición:** Shipment que NO tenga `shipping_method_config` ni valores en meta.

**Pasos:**

1. Navegar al shipment sin configuración de shipping
2. Abrir la vista de detalle
3. Verificar que la página carga sin errores

**Validaciones:**

- [ ] La página carga correctamente (no error 500)
- [ ] Los campos de shipping se muestran vacíos o con valores por defecto
- [ ] No hay excepciones en consola ni logs del servidor
- [ ] El usuario puede seguir navegando sin problemas

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-006 — Config sin `mail_type`

**Prioridad:** 🟡 Media  
**Precondición:** Shipment con `shipping_method_config` que NO incluya `mail_type`.

**Pasos:**

1. Abrir un shipment con config parcial (sin `mail_type`)
2. Verificar cómo maneja el campo faltante

**Validaciones:**

- [ ] La página no lanza error por campo faltante
- [ ] El campo `mail_type` se muestra vacío o con valor por defecto
- [ ] Los demás campos (carrier, ship method) se muestran correctamente
- [ ] No afecta la funcionalidad general del shipment

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-007 — Shipment con estado `shipped`

**Prioridad:** 🟡 Media  
**Precondición:** Shipment con estado `shipped` y `shipping_method_config` asignado.

**Pasos:**

1. Buscar un shipment con estado `shipped`
2. Abrir la vista de detalle
3. Verificar los datos de shipping

**Validaciones:**

- [ ] Los datos de shipping se muestran correctamente en estado `shipped`
- [ ] El carrier, ship method y mail_type son consistentes
- [ ] La información es de solo lectura (no editable)
- [ ] No hay discrepancias con los datos originales

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-008 — Shipment con estado `voided`

**Prioridad:** 🟡 Media  
**Precondición:** Shipment con estado `voided` y `shipping_method_config` asignado.

**Pasos:**

1. Buscar un shipment con estado `voided`
2. Abrir la vista de detalle
3. Verificar los datos de shipping

**Validaciones:**

- [ ] Los datos de shipping se muestran a pesar del estado `voided`
- [ ] No se genera error al acceder al shipment voided
- [ ] La información refleja los datos previos al void
- [ ] El estado `voided` se muestra correctamente

**Resultado:** ☐ Pass | ☐ Fail

---

## Suite 4: API

### TC-009 — Shipment creado vía API con shipping method

**Prioridad:** 🔴 Crítica  
**Precondición:** Acceso al API, credenciales válidas.

**Pasos:**

1. Crear un shipment vía API incluyendo `shipping_method_config` en el payload
2. Verificar la respuesta del API (status 200/201)
3. Abrir el shipment creado en la UI
4. Verificar que los datos de shipping coinciden

**Validaciones:**

- [ ] El API responde con status exitoso (200/201)
- [ ] El shipment se crea con el `shipping_method_config` correcto
- [ ] En la UI, el carrier se muestra según lo enviado en el API
- [ ] El ship method y mail_type coinciden con el payload del API
- [ ] No hay discrepancias entre datos del API y la UI

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-010 — Shipment creado vía API sin shipping method

**Prioridad:** 🟡 Media  
**Precondición:** Acceso al API, credenciales válidas.

**Pasos:**

1. Crear un shipment vía API SIN incluir `shipping_method_config`
2. Verificar la respuesta del API
3. Abrir el shipment en la UI

**Validaciones:**

- [ ] El API responde exitosamente sin requerir shipping method
- [ ] El shipment se crea correctamente sin config de shipping
- [ ] En la UI, los campos de shipping están vacíos o con defaults
- [ ] No se genera error 500 al acceder al shipment

**Resultado:** ☐ Pass | ☐ Fail

---

## Suite 5: Roles

### TC-011 — Regresión del Admin

**Prioridad:** 🔴 Crítica  
**Precondición:** Usuario con rol `admin`.

**Pasos:**

1. Iniciar sesión como `admin`
2. Navegar a la lista de shipments
3. Abrir un shipment con `shipping_method_config`
4. Verificar datos de shipping
5. Verificar que puede editar/gestionar el shipment

**Validaciones:**

- [ ] El admin ve todos los datos de shipping correctamente
- [ ] Tiene permisos completos de edición
- [ ] Los datos de `shipping_method_config` se muestran sin errores
- [ ] Las acciones de admin (editar, void, re-ship) funcionan correctamente
- [ ] No hay regresión en las capacidades del admin

**Resultado:** ☐ Pass | ☐ Fail

---

### TC-012 — Múltiples shipments en un resultado

**Prioridad:** 🟡 Media  
**Precondición:** Vista de lista con múltiples shipments, algunos con config y otros sin.

**Pasos:**

1. Navegar a la lista de shipments
2. Filtrar para mostrar múltiples resultados
3. Verificar que la lista carga correctamente
4. Abrir shipments individuales de la lista

**Validaciones:**

- [ ] La lista carga sin errores con shipments mixtos (con y sin config)
- [ ] Los datos de shipping se muestran en la lista donde aplique
- [ ] La paginación funciona correctamente
- [ ] No hay degradación de performance con múltiples registros
- [ ] Cada shipment individual muestra datos consistentes al abrirlo

**Resultado:** ☐ Pass | ☐ Fail

---

## 🐛 Template de Bug Report

Usar este template para reportar cualquier fallo encontrado durante la ejecución del plan:

```
### Bug #[NRO]

**Test Case:** TC-0XX
**Severidad:** 🔴 Crítica | 🟠 Alta | 🟡 Media | 🟢 Baja
**Estado:** Abierto

**Descripción:**
[Descripción breve del problema]

**Pasos para reproducir:**
1. 
2. 
3. 

**Resultado esperado:**
[Qué debería pasar]

**Resultado actual:**
[Qué pasó realmente]

**Evidencia:**
- Screenshot: [adjuntar]
- Console log: [adjuntar]
- Network request: [adjuntar]

**Ambiente:**
- URL: 
- Browser: 
- Rol de usuario: 
- Shipment ID: 
```

---

## 📝 Registro de Ejecución

| Test Case | Obligatorio | Ejecutado | Resultado | Fecha | Notas |
| :--- | :---: | :---: | :---: | :--- | :--- |
| TC-001 | ✅ | ☐ | ☐ Pass / ☐ Fail | | |
| TC-002 | ✅ | ☐ | ☐ Pass / ☐ Fail | | |
| TC-003 | ✅ | ☐ | ☐ Pass / ☐ Fail | | |
| TC-004 | | ☐ | ☐ Pass / ☐ Fail | | |
| TC-005 | ✅ | ☐ | ☐ Pass / ☐ Fail | | |
| TC-006 | | ☐ | ☐ Pass / ☐ Fail | | |
| TC-007 | | ☐ | ☐ Pass / ☐ Fail | | |
| TC-008 | | ☐ | ☐ Pass / ☐ Fail | | |
| TC-009 | ✅ | ☐ | ☐ Pass / ☐ Fail | | |
| TC-010 | | ☐ | ☐ Pass / ☐ Fail | | |
| TC-011 | ✅ | ☐ | ☐ Pass / ☐ Fail | | |
| TC-012 | | ☐ | ☐ Pass / ☐ Fail | | |

**Sign-off:** ☐ Aprobado | ☐ Rechazado  
**Aprobado por:** _______________  
**Fecha:** _______________





warehousemanagerX@yopmail.com