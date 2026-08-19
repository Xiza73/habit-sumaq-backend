# API Reference — Frontend

Base URL: `{APP_URL}` (ej. `http://localhost:3000`)

Todas las respuestas siguen el formato estándar `ApiResponse<T>`:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa",
  "error": null,
  "meta": null
}
```

En caso de error:

```json
{
  "success": false,
  "data": null,
  "message": "Descripción del error",
  "error": {
    "code": "ACC_001",
    "details": [{ "field": "name", "message": "name should not be empty" }]
  }
}
```

> **Autenticación:** Todos los endpoints (salvo los de OAuth) requieren header `Authorization: Bearer <accessToken>`.

---

## Auth

### `GET /auth/google`

Inicia el flujo OAuth con Google. **Redirige al navegador** a la pantalla de consentimiento de Google.

### `GET /auth/google/callback`

Callback de Google. **No llamar directamente.** Google redirige aquí y el backend redirige al frontend con el access token:

```
{FRONTEND_URL}/auth/callback?accessToken=...
```

El refresh token se establece automáticamente como cookie `HttpOnly`.

### `POST /auth/refresh`

Rota el access token usando el refresh token de la cookie.

- **Rate limit:** máximo 10 requests por 60 segundos
- **Cookie requerida:** `refreshToken` (HttpOnly, establecida por el callback)
- **Response:** `{ accessToken: string }`

### `POST /auth/logout`

Cierra sesión y revoca el refresh token.

- **Response:** `204 No Content`

### `GET /auth/me`

Retorna el perfil del usuario autenticado.

- **Response:**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Daniel",
  "avatar": "https://...",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## User Settings

### `GET /users/settings`

Obtiene la configuración del usuario autenticado. Si no existe, se crea automáticamente con valores por defecto.

**Response:** `200` — `UserSettingsResponseDto`

### `PATCH /users/settings`

Actualiza parcialmente la configuración. Solo se modifican los campos enviados.

| Campo                       | Tipo                       | Notas                                                                          |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `language`                  | Language                   | Ver [enums.md](enums.md#language)                                              |
| `theme`                     | Theme                      | Ver [enums.md](enums.md#theme)                                                 |
| `defaultCurrency`           | Currency                   | Ver [enums.md](enums.md#currency)                                              |
| `dateFormat`                | DateFormat                 | Ver [enums.md](enums.md#dateformat)                                            |
| `startOfWeek`               | StartOfWeek                | Ver [enums.md](enums.md#startofweek)                                           |
| `timezone`                  | string                     | IANA zone (ej: `America/Lima`). Validado server-side con `Intl.DateTimeFormat` |
| `monthlyServicesGroupBy`    | MonthlyServicesGroupBy     | Ver [enums.md](enums.md#monthlyservicesgroupby)                                |
| `monthlyServicesOrderBy`    | MonthlyServicesOrderBy     | Ver [enums.md](enums.md#monthlyservicesorderby)                                |
| `monthlyServicesOrderDir`   | MonthlyServicesOrderDir    | Ver [enums.md](enums.md#monthlyservicesorderdir)                               |
| `favoriteKeys`              | string[]                   | Max 4, sin duplicados. Drives la bottom nav en mobile (4 slots + Settings fijo) y la ★ en la sidebar. Strings free-form — el set válido vive en el `NAV_REGISTRY` del frontend; el backend no valida el contenido para desacoplar repos. Array vacío es válido. |

Todos los campos son opcionales. Si no existe configuración previa, se crea antes de aplicar los cambios.

**Response:** `200` — `UserSettingsResponseDto`

### Respuesta de configuración (`UserSettingsResponseDto`)

```json
{
  "id": "uuid",
  "language": "es",
  "theme": "system",
  "defaultCurrency": "PEN",
  "dateFormat": "DD/MM/YYYY",
  "startOfWeek": "monday",
  "timezone": "America/Lima",
  "monthlyServicesGroupBy": "none",
  "monthlyServicesOrderBy": "name",
  "monthlyServicesOrderDir": "asc",
  "favoriteKeys": ["accounts", "transactions", "habits", "quick-tasks"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

> **Timezone default:** Usuarios pre-existentes tienen `'UTC'` hasta que el frontend auto-detecte su zona en el primer login post-deploy y haga un PATCH silencioso. Una vez seteado, el backend lo usa para cálculos "por día" como el cleanup diario de quick-tasks y el rango calendario-alineado (`month`, `3m`) en reports.

> **`favoriteKeys` default:** La migration `1741000023000` setea el default a `['accounts','transactions','habits','quick-tasks']` para todos los users (los 4 items que mobile ya mostraba antes del feature). Usuarios pre-existentes obtienen ese default sin acción adicional. Las strings son free-form: el frontend mapea `key → href/icon/labelKey` vía su `NAV_REGISTRY`, e ignora silenciosamente las keys desconocidas. Eso permite agregar o renombrar rutas en frontend sin migration de backend.

---

## Accounts

### `POST /accounts`

Crea una nueva cuenta.

| Campo            | Tipo           | Requerido | Notas                                |
| ---------------- | -------------- | --------- | ------------------------------------ |
| `name`           | string         | sí        | Máx 100 chars. Único por usuario     |
| `type`           | AccountType    | sí        | Ver [enums.md](enums.md#accounttype) |
| `currency`       | Currency       | sí        | Ver [enums.md](enums.md#currency)    |
| `initialBalance` | number         | no        | Default `0`. Mín `0`                 |
| `color`          | string \| null | no        | Máx 7 chars (hex: `#FF5733`)         |
| `icon`           | string \| null | no        | Máx 50 chars                         |

**Response:** `201` — `AccountResponseDto`

**Errores:**

- `409` — Ya existe una cuenta con ese nombre

### `GET /accounts`

Lista las cuentas del usuario.

| Query param       | Tipo    | Descripción                           |
| ----------------- | ------- | ------------------------------------- |
| `includeArchived` | boolean | Si `true`, incluye cuentas archivadas |

**Response:** `200` — `AccountResponseDto[]`

### `GET /accounts/:id`

Obtiene una cuenta por UUID.

**Errores:**

- `403` — La cuenta pertenece a otro usuario
- `404` — Cuenta no encontrada

### `PATCH /accounts/:id`

Actualiza nombre, color e ícono.

| Campo   | Tipo           | Notas         |
| ------- | -------------- | ------------- |
| `name`  | string         | Máx 100 chars |
| `color` | string \| null | Máx 7 chars   |
| `icon`  | string \| null | Máx 50 chars  |

> **Nota:** `type` y `currency` no son editables.

**Errores:**

- `404` — Cuenta no encontrada
- `409` — Nombre ya en uso

### `PATCH /accounts/:id/archive`

Archiva o desarchiva una cuenta. No recibe body.

### `DELETE /accounts/:id`

Soft delete. Falla si la cuenta tiene transacciones activas.

**Errores:**

- `404` — Cuenta no encontrada
- `409` — La cuenta tiene transacciones activas

### Respuesta de cuenta (`AccountResponseDto`)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Mi cuenta",
  "type": "checking",
  "currency": "PEN",
  "balance": 1500.5,
  "color": "#4CAF50",
  "icon": "wallet",
  "isArchived": false,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Categories

### `POST /categories`

Crea una categoría.

| Campo   | Tipo           | Requerido | Notas                                     |
| ------- | -------------- | --------- | ----------------------------------------- |
| `name`  | string         | sí        | Máx 100 chars. Único por usuario + tipo   |
| `type`  | CategoryType   | sí        | `INCOME` o `EXPENSE`. No editable después |
| `color` | string \| null | no        | Máx 7 chars                               |
| `icon`  | string \| null | no        | Máx 50 chars                              |

**Response:** `201` — `CategoryResponseDto`

**Errores:**

- `409` — Ya existe una categoría con ese nombre y tipo

### `GET /categories`

Lista categorías del usuario (incluye las por defecto).

| Query param | Tipo         | Descripción                      |
| ----------- | ------------ | -------------------------------- |
| `type`      | CategoryType | Filtrar por `INCOME` o `EXPENSE` |

**Response:** `200` — `CategoryResponseDto[]`

### `GET /categories/:id`

Obtiene una categoría por UUID.

**Errores:**

- `403` — Pertenece a otro usuario
- `404` — No encontrada

### `PATCH /categories/:id`

Actualiza nombre, color e ícono. El tipo (`INCOME`/`EXPENSE`) **no es editable**.

**Errores:**

- `404` — No encontrada
- `409` — Nombre ya en uso para este tipo

### `DELETE /categories/:id`

Soft delete. Las categorías por defecto (`isDefault=true`) no se pueden eliminar.

**Errores:**

- `404` — No encontrada
- `409` — No se pueden eliminar categorías por defecto

### Respuesta de categoría (`CategoryResponseDto`)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Alimentación",
  "type": "EXPENSE",
  "color": "#FF5733",
  "icon": "utensils",
  "isDefault": false,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Monthly Service Payments (v1.0.0)

> **Refactor v1.0.0 (in progress — Phase A4-B.4):** estos endpoints viven en el módulo nuevo
> `monthly_service_payments`. Los EXPENSE legacy con `monthlyServiceId IS NOT NULL` siguen
> funcionando bajo `/transactions` hasta que Phase A6 retire el módulo viejo.

### `GET /monthly-service-payments`

Lista pagos de un servicio mensual. Ordenados por `period` desc.

| Query param | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `monthlyServiceId` | UUID | sí | ID del servicio mensual a listar. |

**Respuesta:** `200 OK`, `data: MonthlyServicePaymentResponseDto[]`.

### `GET /monthly-service-payments/:id`

Obtiene un pago por id.

| Error code | HTTP | Cuándo |
| --- | --- | --- |
| `MSP_001` | 404 | id no existe |
| `MSP_002` | 403 | El pago pertenece a otro usuario |

### `POST /monthly-service-payments`

Registra un pago. **DEBITA el currency pool** del user por `amount` (el monto TOTAL de la
factura). Currency se hereda del servicio. `period` (`YYYY-MM`) es explícito — se puede
back-pay o pay-ahead. La combinación `(monthlyServiceId, period)` es única entre rows activas.

| Campo | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `monthlyServiceId` | UUID | sí | Servicio que se paga. |
| `period` | `YYYY-MM` | sí | Período al que aplica el pago. |
| `amount` | number | sí | > 0, hasta 2 decimales. Monto TOTAL de la factura (incluye la parte de todos los participantes). |
| `date` | ISO datetime | no | Fecha real del pago. Default: ahora. NO determina el period. |
| `description` | string | no | Max 255 chars. |
| `participants` | array | no | Splits para servicios compartidos. Ver abajo. |

**Splits (`participants[]`, servicios compartidos):**

```json
{
  "monthlyServiceId": "uuid",
  "period": "2026-06",
  "amount": 300.0,
  "participants": [
    { "reference": "Ana", "amount": 100.0, "alreadyPaid": false },
    { "reference": "Luis", "amount": 80.0, "alreadyPaid": true }
  ]
}
```

| Campo | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `reference` | string | sí | Nombre de la persona. No tiene que coincidir literalmente con un participante configurado — se usa tal cual para crear el préstamo (`LOAN`) vinculado. |
| `amount` | number | sí | > 0. Monto que le corresponde a esta persona para ESTE pago (puede diferir del `defaultAmount` configurado). |
| `alreadyPaid` | boolean | no (default `false`) | Si `true`, el préstamo se crea y liquida en la misma transacción (la persona ya te devolvió su parte). Si `false`, queda `PENDING`. |

Reglas:

- El pool SIEMPRE se debita por el `amount` TOTAL del pago — el usuario adelanta la factura completa.
- La parte propia del usuario (`amount − sum(participants[].amount)`) NO genera ningún registro en Deudas/Préstamos — es implícita.
- `sum(participants[].amount)` NO puede superar `amount`. Se valida ANTES de tocar la base de datos.
- Por cada participante se crea un `LOAN` (préstamo) en el módulo Deudas/Préstamos, vinculado a este pago vía `sourceMonthlyServicePaymentId`. Si `alreadyPaid=true`, el préstamo queda `SETTLED` de inmediato (con su crédito al pool aplicado en la misma transacción); si no, queda `PENDING` y se liquida después desde `POST /debts/:id/settle`.
- El `LOAN` generado siempre lleva `description = "{service.name} · {period}"` (ej. `"Netflix · 2026-07"`), para que la vista de Deudas/Préstamos pueda mostrar de dónde salió el préstamo.
- Si `participants` se omite o es un array vacío, el pago se comporta exactamente igual que un pago no compartido (sin cambios de comportamiento).
- Todo lo anterior ocurre en UNA sola transacción atómica junto con el pago y la sincronización del servicio — si algo falla, no queda estado parcial.

**Respuesta:** `201 Created`, `data: MonthlyServicePaymentResponseDto`.

| Error code | HTTP | Cuándo |
| --- | --- | --- |
| `MSP_003` | 409 | Ya existe un pago activo para ese `(service, period)` |
| `MSP_005` | 422 | `period` mal formado |
| `MSP_010` | 422 | `sum(participants[].amount)` supera `amount` |

### `PATCH /monthly-service-payments/:id`

Actualiza `amount`, `date`, `description`. `monthlyServiceId`, `currency`, y `period` son
inmutables. Si cambia el `amount`, el pool ajusta la diferencia en una sola tx.

**Respuesta:** `200 OK`, `data: MonthlyServicePaymentResponseDto`.

### `DELETE /monthly-service-payments/:id`

Soft-deletea el pago Y **revierte el pool** (`+amount`). Mismo patrón que
`DELETE /budget-movements/:id`.

Si el pago tenía préstamos vinculados (`sourceMonthlyServicePaymentId`), los que estén
`PENDING` se soft-deletean también (en la misma transacción). Los que ya estén `SETTLED`
quedan intactos como historial — su crédito al pool NO se revierte.

**Respuesta:** `204 No Content`.

### Respuesta de Monthly Service Payment (`MonthlyServicePaymentResponseDto`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID | |
| `userId` | UUID | |
| `monthlyServiceId` | UUID | Inmutable. |
| `currency` | `'PEN' \| 'USD' \| 'EUR'` | Heredado del servicio. Inmutable. |
| `amount` | number | |
| `period` | `YYYY-MM` | Inmutable. |
| `description` | string \| null | |
| `date` | ISO datetime | Fecha real del pago. Distinta del period. |
| `createdAt` | ISO datetime | |
| `updatedAt` | ISO datetime | |

---

## Budget Movements (v1.0.0)

> **Refactor v1.0.0 (in progress — Phase A4-B):** estos endpoints viven en el módulo nuevo
> `budget_movements`. Los EXPENSE legacy con `budgetId IS NOT NULL` siguen funcionando bajo
> `/transactions` hasta que Phase A6 retire el módulo viejo. El frontend debería migrar
> progresivamente al módulo nuevo.

### `GET /budget-movements`

Lista movimientos de un budget. Ordenados por fecha desc.

| Query param | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `budgetId` | UUID | sí | ID del budget a listar. |

**Respuesta:** `200 OK`, `data: BudgetMovementResponseDto[]`.

| Error code | HTTP | Cuándo |
| --- | --- | --- |
| `BUDGET_NOT_FOUND` | 404 | `budgetId` no existe |
| `BMV_002` | 403 | El budget pertenece a otro usuario |

### `GET /budget-movements/:id`

Obtiene un movimiento por id.

| Error code | HTTP | Cuándo |
| --- | --- | --- |
| `BMV_001` | 404 | id no existe |
| `BMV_002` | 403 | El movimiento pertenece a otro usuario |

### `POST /budget-movements`

Crea un movimiento contra un budget. NEUTRAL para el budget (la tabla `budgets` no se toca),
pero **DEBITA el currency pool** del user por `amount`. La currency se hereda del budget —
NO se pasa en el DTO.

| Campo | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `budgetId` | UUID | sí | Budget contra el que se imputa. |
| `amount` | number | sí | > 0, hasta 2 decimales. |
| `date` | ISO datetime | no | Debe caer en el mes del budget. Default: ahora. |
| `description` | string | no | Max 255 chars. |
| `categoryId` | UUID | no | Categoría opcional. |

**Respuesta:** `201 Created`, `data: BudgetMovementResponseDto`.

| Error code | HTTP | Cuándo |
| --- | --- | --- |
| `BMV_003` | 422 | `date` no cae dentro del `(year, month)` del budget |

### `PATCH /budget-movements/:id`

Actualiza `amount`, `date`, `description`, `categoryId`. `budgetId` y `currency` son
inmutables — para "mover" un movement, delete + recreate.

Si cambia el `amount`, el pool aplica la diferencia `(oldAmount - newAmount)` en una sola tx:
- Bajar el amount 100 → 80 → pool **+20** (reembolso parcial).
- Subir el amount 100 → 120 → pool **-20** (débito extra).

Si cambia el `date`, se revalida contra el mes del budget.

**Respuesta:** `200 OK`, `data: BudgetMovementResponseDto`.

### `DELETE /budget-movements/:id`

Soft-deletea el movimiento Y **revierte el pool** (`+amount`). El gasto se "deshace" — a
diferencia de `DELETE /debts/:id` que NO toca el pool.

**Respuesta:** `204 No Content`.

### Respuesta de Budget Movement (`BudgetMovementResponseDto`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID | |
| `userId` | UUID | |
| `budgetId` | UUID | Inmutable. |
| `currency` | `'PEN' \| 'USD' \| 'EUR'` | Heredado del budget. Inmutable. |
| `amount` | number | |
| `description` | string \| null | |
| `categoryId` | UUID \| null | |
| `date` | ISO datetime | |
| `createdAt` | ISO datetime | |
| `updatedAt` | ISO datetime | |

---

## Debts and Loans

> **Refactor v1.0.0 (in progress — Phase A3-B):** estos endpoints viven en el módulo nuevo `debts_loans`,
> introducido por el refactor `accounts-to-modular-finance`. Los endpoints viejos de DEBT/LOAN bajo
> `/transactions` (settle, settle-by-reference, debts-summary, create con type=DEBT|LOAN) **permanecen
> activos** hasta que Phase A6 retire el módulo legacy. Durante esa ventana, el frontend debería
> migrar progresivamente al módulo nuevo.

### `POST /debts`

Crea una deuda o préstamo. La creación es NEUTRAL para el currency pool — el pool solo se mueve cuando
se hace settle en real-payment mode.

| Campo         | Tipo                    | Requerido | Notas                                                  |
| ------------- | ----------------------- | --------- | ------------------------------------------------------ |
| `type`        | `'DEBT' \| 'LOAN'`      | sí        | DEBT = el user debe; LOAN = al user le deben.          |
| `currency`    | `'PEN' \| 'USD' \| 'EUR'` | sí      | Moneda de la obligación. Inmutable post-creación.     |
| `amount`      | number                  | sí        | Monto total. > 0, hasta 2 decimales.                   |
| `reference`   | string                  | sí        | Persona/contraparte. Vacío rechaza con `DBT_003`.      |
| `description` | string                  | no        | Descripción libre. Max 255 chars.                      |
| `date`        | ISO datetime            | no        | Default: ahora.                                         |
| `categoryId`  | UUID                    | no        | Categoría opcional.                                    |

**Respuesta:** `201 Created`, `data: DebtLoanResponseDto`.

### `GET /debts`

Lista las deudas y préstamos del usuario.

| Query param | Tipo                                | Default     | Notas                                              |
| ----------- | ----------------------------------- | ----------- | -------------------------------------------------- |
| `status`    | `'pending' \| 'settled' \| 'all'`   | `'pending'` | Filtro por estado.                                 |

**Respuesta:** `200 OK`, `data: DebtLoanResponseDto[]`.

### `GET /debts/summary`

Resumen agregado por `(LOWER(unaccent(reference)), currency)`. Misma shape que el endpoint legacy
`/transactions/debts-summary` — el dashboard del web no necesita cambiar render.

| Query param | Tipo                                | Default     |
| ----------- | ----------------------------------- | ----------- |
| `status`    | `'pending' \| 'settled' \| 'all'`   | `'pending'` |

**Respuesta:** `200 OK`, `data: DebtsSummaryResponseDto[]`.

### `GET /debts/:id`

Obtener una deuda/préstamo por id.

| Error code | HTTP | Cuándo                              |
| ---------- | ---- | ----------------------------------- |
| `DBT_001`  | 404  | El id no existe (o está soft-deleted) |
| `DBT_002`  | 403  | El row pertenece a otro usuario     |

**Respuesta exitosa:** `200 OK`, `data: DebtLoanResponseDto`.

### `PATCH /debts/:id`

Actualiza campos editables. Reglas:

- **Si status = PENDING**: se pueden tocar `amount`, `description`, `date`, `categoryId`, `reference`.
- **Si status = SETTLED**: solo `amount` es editable; cualquier otro campo presente rejecta con `DBT_005`.
- `amount` nunca puede ser menor a `(amount - remainingAmount)` (lo ya liquidado) → `DBT_007`.
- Subir `amount` en una SETTLED reabre el row a PENDING (recalcula `remainingAmount`).
- `reference` vacío (solo whitespace) → `DBT_003`.

| Campo         | Tipo                  | Notas                                        |
| ------------- | --------------------- | -------------------------------------------- |
| `amount`      | number                | > 0, 2 decimales, ≥ alreadySettled.          |
| `description` | string \| null        | Pasar null para limpiar.                     |
| `date`        | ISO datetime          |                                              |
| `categoryId`  | UUID \| null          |                                              |
| `reference`   | string (1..255)       |                                              |

**Respuesta:** `200 OK`, `data: DebtLoanResponseDto`.

### `DELETE /debts/:id`

Soft-delete del row. **No revierte deltas de pool previos** — si la deuda tuvo real-payment settles,
esos movimientos quedan registrados en el currency pool.

**Respuesta:** `204 No Content`.

### `POST /debts/:id/settle`

Liquida (parcial o total) una deuda/préstamo. Dos modos:

| Modo            | Trigger                  | Efecto en pool                                      |
| --------------- | ------------------------ | --------------------------------------------------- |
| Real-payment    | `currency` presente      | DEBT debita, LOAN credita. Atómico con el row write. |
| Informal-close  | `currency` omitido       | Solo marca SETTLED; pool no se toca.                |

Si el row pasa a `remainingAmount = 0`, status → SETTLED. En real-payment mode, `currency` DEBE
coincidir con la currency del row; mismatch → `CURRENCY_MISMATCH`.

| Campo           | Tipo                                | Requerido | Notas                                  |
| --------------- | ----------------------------------- | --------- | -------------------------------------- |
| `settledAmount` | number                              | sí        | > 0 y ≤ `remainingAmount`.             |
| `currency`      | `'PEN' \| 'USD' \| 'EUR'`           | no        | Presencia → real-payment. Match obligatorio. |

| Error code         | HTTP | Cuándo                                          |
| ------------------ | ---- | ----------------------------------------------- |
| `DBT_004`          | 409  | Row ya SETTLED.                                  |
| `DBT_006`          | 422  | `settledAmount > remainingAmount`.               |
| `CURRENCY_MISMATCH`| 422  | `currency` no coincide con la del row.           |

**Respuesta:** `200 OK`, `data: DebtLoanResponseDto`.

### `POST /debts/settle-by-reference`

Liquida en una sola operación TODAS las rows PENDING de una misma `reference` (case + accent insensitive).

| Campo       | Tipo                                | Requerido | Notas                                          |
| ----------- | ----------------------------------- | --------- | ---------------------------------------------- |
| `reference` | string                              | sí        | Match case + accent insensitive.               |
| `currency`  | `'PEN' \| 'USD' \| 'EUR'`           | no        | Presente → solo esa currency + delta de pool. Omitido → todas las currencies, sin pool. |

Devuelve el resumen del bulk. Si no había nada que liquidar, `settledCount: 0` (NO es error).

**Respuesta:** `200 OK`, `data: BulkSettleResultDto`:

| Campo                | Tipo                                | Notas                                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------ |
| `settledCount`       | number                              | Rows liquidadas en este bulk.                          |
| `totalSettledAmount` | number                              | Suma de remainingAmount liquidados.                    |
| `currency`           | `Currency \| null`                  | Null si fue informal-close cross-currency.             |
| `settledIds`         | UUID[]                              | IDs de las rows afectadas.                             |

### `POST /debts/settle-amount-by-reference`

Liquida un **monto** repartido _oldest-first_ (FIFO) sobre las rows PENDING de **una persona**,
en **una sola dirección** (`type`) y **una sola moneda** (`currency`) — la "Mochila". El monto se
consume desde la deuda más vieja hacia la más nueva: cada una se liquida por
`min(remainingAmount, montoRestante)`. La última tocada puede quedar **parcialmente** liquidada
(sigue PENDING con saldo). Si `amount` supera la suma de saldos pendientes, se liquidan **todas**
sin error (cap — el excedente se ignora). Toda la aritmética se hace en centavos enteros.

> A diferencia de `/debts/:id/settle` y `/debts/settle-by-reference` (donde la **presencia** de
> `currency` togglea real-vs-informal), acá `currency` es **obligatoria** porque identifica el grupo
> `(reference, currency)`. El toggle de modo pasa por el flag `realPayment`.

| Campo         | Tipo                      | Requerido | Notas                                                                 |
| ------------- | ------------------------- | --------- | --------------------------------------------------------------------- |
| `reference`   | string                    | sí        | La persona. Match case + accent insensitive. Máx 255 chars.           |
| `currency`    | `'PEN' \| 'USD' \| 'EUR'` | sí        | Identifica el grupo `(reference, currency)` a liquidar.               |
| `type`        | `'DEBT' \| 'LOAN'`        | sí        | Dirección a liquidar. `DEBT` = lo que debés; `LOAN` = lo que te deben. |
| `amount`      | number                    | sí        | > 0, 2 decimales. Se reparte FIFO. Si excede el total, cap sin error. |
| `realPayment` | boolean                   | no        | `true` → mueve el pool (DEBT debita, LOAN credita). Omitido/`false` → cierre informal (no toca pool). Default `false`. |

| Error code | HTTP | Cuándo                                                          |
| ---------- | ---- | -------------------------------------------------------------- |
| `DBT_011`  | 404  | No hay rows PENDING para ese `(reference, currency, type)`.     |

**Respuesta:** `200 OK`, `data: SettleAmountByReferenceResultDto`:

| Campo                 | Tipo                | Notas                                                                 |
| --------------------- | ------------------- | --------------------------------------------------------------------- |
| `settledCount`        | number              | Rows tocadas (total o parcialmente) en este settle.                   |
| `totalSettledAmount`  | number              | Monto efectivamente liquidado (= `amount`, salvo cap = suma de saldos). |
| `fullySettledCount`   | number              | Cuántas de las tocadas quedaron completamente liquidadas (SETTLED).   |
| `partiallySettledId`  | `UUID \| null`      | Id de la última row parcial (sigue PENDING), o `null` si no hubo parcial. |
| `currency`            | `Currency`          | Moneda del grupo liquidado.                                           |
| `type`                | `'DEBT' \| 'LOAN'`  | Dirección liquidada.                                                  |

> **Nota de migración:** `POST /debts/settle-by-reference` (liquidar TODO de una reference) sigue
> vigente. Una vez que el frontend migre a este endpoint por monto, aquel podría volverse removible.

### `GET /debts/:id/payments`

Lista el historial de pagos (settles) aplicados a una deuda/préstamo, más reciente primero.
Cada row representa un evento de settle (parcial o total). `currency` es `null` para settles
informales (sin paso por el pool).

| Error code | HTTP | Cuándo                              |
| ---------- | ---- | ----------------------------------- |
| `DBT_001`  | 404  | El id no existe (o está soft-deleted) |
| `DBT_002`  | 403  | El row pertenece a otro usuario     |

**Respuesta:** `200 OK`, `data: DebtLoanPaymentResponseDto[]`.

### `PATCH /debts/payments/:paymentId`

Edita un pago del historial (`amount` y/o `note`). Recomputa `remainingAmount` y `status`
del parent (`SETTLED` ↔ `PENDING`) de forma atómica. Si el pago es real-payment (tiene
`currency`), revierte el delta previo en el pool y aplica el nuevo. `currency` NO es editable
post-creación. Debe enviarse al menos uno de `amount` o `note`.

| Campo    | Tipo            | Requerido        | Notas                                                |
| -------- | --------------- | ---------------- | ---------------------------------------------------- |
| `amount` | number          | no (al menos uno) | > 0, 2 decimales. Recomputa saldo y status.         |
| `note`   | string \| null  | no (al menos uno) | Máx 255 chars. `null` borra la nota.                |

| Error code | HTTP | Cuándo                                                          |
| ---------- | ---- | --------------------------------------------------------------- |
| `DBT_008`  | 404  | El payment no existe                                            |
| `DBT_002`  | 403  | El payment pertenece a otro usuario                             |
| `DBT_009`  | 422  | Body sin `amount` ni `note`                                     |
| `DBT_006`  | 422  | El nuevo `amount` haría `remainingAmount < 0` (sobrepago)       |
| `DBT_010`  | 422  | El nuevo `remainingAmount` excedería el `amount` del debt/loan  |

**Respuesta:** `200 OK`, `data: DebtLoanPaymentResponseDto`.

### `DELETE /debts/payments/:paymentId`

Hard-delete de un pago del historial. Recomputa `remainingAmount` y `status` del parent
(`remainingAmount += payment.amount`). Si el row estaba `SETTLED` y al borrar el pago
queda saldo pendiente, se reabre a `PENDING`. Si el pago era real-payment (tiene `currency`),
revierte el delta del pool.

| Error code | HTTP | Cuándo                              |
| ---------- | ---- | ----------------------------------- |
| `DBT_008`  | 404  | El payment no existe                |
| `DBT_002`  | 403  | El payment pertenece a otro usuario |

**Respuesta:** `204 No Content`.

### Respuesta de Payment (`DebtLoanPaymentResponseDto`)

| Campo       | Tipo                                | Notas                                                  |
| ----------- | ----------------------------------- | ------------------------------------------------------ |
| `id`        | UUID                                |                                                        |
| `amount`    | number                              | Monto del pago.                                        |
| `currency`  | `'PEN' \| 'USD' \| 'EUR' \| null`   | Null para settles informales (sin paso por el pool).   |
| `note`      | string \| null                      | Nota libre, máx 255 chars.                             |
| `createdAt` | ISO datetime                        |                                                        |

### Respuesta de Debt/Loan (`DebtLoanResponseDto`)

| Campo             | Tipo                                | Notas                                  |
| ----------------- | ----------------------------------- | -------------------------------------- |
| `id`              | UUID                                |                                        |
| `userId`          | UUID                                |                                        |
| `type`            | `'DEBT' \| 'LOAN'`                  |                                        |
| `currency`        | `'PEN' \| 'USD' \| 'EUR'`           | Inmutable.                             |
| `amount`          | number                              | Total de la obligación.                |
| `remainingAmount` | number                              | Saldo pendiente. 0 ⇔ status = SETTLED. |
| `status`          | `'PENDING' \| 'SETTLED'`            |                                        |
| `reference`       | string                              |                                        |
| `description`     | string \| null                      |                                        |
| `categoryId`      | UUID \| null                        |                                        |
| `date`            | ISO datetime                        |                                        |
| `createdAt`       | ISO datetime                        |                                        |
| `updatedAt`       | ISO datetime                        |                                        |

---

## Transactions

### `POST /transactions`

Crea una transacción.

| Campo                  | Tipo            | Requerido   | Notas                                       |
| ---------------------- | --------------- | ----------- | ------------------------------------------- |
| `accountId`            | UUID            | sí          | Cuenta origen                               |
| `categoryId`           | UUID \| null    | no          | Categoría asociada                          |
| `type`                 | TransactionType | sí          | Ver [enums.md](enums.md#transactiontype)    |
| `amount`               | number          | sí          | Mín `0.01`, máx 2 decimales                 |
| `description`          | string \| null  | no          | Máx 255 chars                               |
| `date`                 | ISO 8601        | sí          | Fecha de la transacción                     |
| `destinationAccountId` | UUID \| null    | condicional | **Requerido** para TRANSFER                 |
| `reference`            | string \| null  | condicional | **Requerido** para DEBT/LOAN. Máx 255 chars |

**Comportamiento por tipo:**

| Tipo     | Efecto en balance                         | Campos especiales                                |
| -------- | ----------------------------------------- | ------------------------------------------------ |
| INCOME   | `+amount` en `accountId`                  | —                                                |
| EXPENSE  | `−amount` en `accountId`                  | —                                                |
| TRANSFER | `−amount` en origen, `+amount` en destino | `destinationAccountId` requerido                 |
| DEBT     | Sin efecto                                | `reference` requerido. Crea con `status=PENDING` |
| LOAN     | Sin efecto                                | `reference` requerido. Crea con `status=PENDING` |

**Response:** `201` — `TransactionResponseDto`

**Errores:**

- `404` — Cuenta origen o destino no encontrada
- `422` — Monedas distintas (TRANSFER), misma cuenta (TRANSFER), falta reference (DEBT/LOAN)

### `POST /transactions/:id/settle`

Liquida parcial o totalmente una deuda/préstamo.

| Campo         | Tipo           | Requerido | Notas                                                     |
| ------------- | -------------- | --------- | --------------------------------------------------------- |
| `accountId`   | UUID           | sí        | Cuenta de pago (DEBT) o cobro (LOAN)                      |
| `amount`      | number         | sí        | Mín `0.01`, máx 2 decimales. Debe ser ≤ `remainingAmount` |
| `description` | string \| null | no        | Si se omite se genera automáticamente                     |
| `date`        | ISO 8601       | no        | Si se omite usa fecha actual                              |

**Comportamiento:**

- DEBT → crea un **EXPENSE** que debita la cuenta
- LOAN → crea un **INCOME** que acredita la cuenta
- Reduce `remainingAmount` del DEBT/LOAN original
- Si `remainingAmount` llega a `0`, el `status` cambia a `SETTLED`

**Response:** `201` — la transacción de liquidación (`TransactionResponseDto`)

**Errores:**

- `404` — Transacción o cuenta no encontrada
- `409` — Ya fue liquidada completamente (`SETTLED`)
- `422` — No es DEBT/LOAN, o monto excede saldo pendiente

### `POST /transactions/settle-by-reference`

Liquida en bloque todas las DEBT/LOAN pendientes que coincidan con una `reference` (normalizada server-side: `LOWER + unaccent`, así `"Juán"`, `"juan"` y `"JUAN"` colapsan en la misma persona).

Tiene **dos modos** según el body:

| Campo       | Tipo             | Requerido | Notas                                                                                    |
| ----------- | ---------------- | --------- | ---------------------------------------------------------------------------------------- |
| `reference` | string           | sí        | Referencia a liquidar (case + accent insensitive)                                        |
| `currency`  | Currency         | no        | Filtra a transacciones cuya cuenta tenga esta moneda. Obligatorio si `accountId` se envía |
| `accountId` | UUID             | no        | **Si se envía**, dispara modo "pago real"                                                |

**Modo informal** (sin `accountId`): marca como `SETTLED` los originales. NO crea transacciones de liquidación ni mueve balances. Útil cuando ya se arregló cara a cara.

**Modo pago real** (con `accountId`): por cada pendiente, crea una transacción de liquidación (EXPENSE para DEBT, INCOME para LOAN) en la cuenta indicada y mueve la plata. Equivale a llamar `POST /transactions/:id/settle` para cada uno en un solo shot. La cuenta debe existir, ser del usuario, y compartir la `currency` del filtro.

**Idempotente**: si no hay pendientes, devuelve `count: 0` sin error.

**Response:** `200` — `BulkSettleResponseDto`:

```json
{
  "settledIds": ["...", "..."],
  "totalSettled": 700,
  "count": 2,
  "settlementIds": ["...", "..."]
}
```

`settlementIds` queda vacío en modo informal y se llena con los IDs de las nuevas EXPENSE/INCOME en modo pago real.

**Errores:**

- `404` — Cuenta de pago no encontrada (solo modo real)
- `403` — La cuenta pertenece a otro usuario (solo modo real)
- `422` — `CURRENCY_MISMATCH` si la cuenta no coincide con la `currency` del filtro

### `GET /transactions`

Lista transacciones del usuario paginadas, ordenadas por fecha descendente.

| Query param  | Tipo              | Descripción                                  |
| ------------ | ----------------- | -------------------------------------------- |
| `page`       | number            | Página (base 1, default: `1`)                |
| `limit`      | number            | Items por página (default: `20`, máx: `100`) |
| `accountId`  | UUID              | Filtrar por cuenta                           |
| `categoryId` | UUID              | Filtrar por categoría                        |
| `type`       | TransactionType   | Filtrar por tipo                             |
| `status`     | TransactionStatus | Filtrar por estado (solo aplica a DEBT/LOAN) |
| `dateFrom`   | ISO 8601          | Fecha mínima (inclusiva)                     |
| `dateTo`     | ISO 8601          | Fecha máxima (inclusiva)                     |

**Response:** `200` — `TransactionResponseDto[]` con `meta` de paginación

```json
{
  "success": true,
  "data": [ ... ],
  "message": "Transacciones obtenidas exitosamente",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### `GET /transactions/:id`

Obtiene una transacción por UUID.

**Errores:**

- `403` — Pertenece a otro usuario
- `404` — No encontrada

### `PATCH /transactions/:id`

Actualiza campos editables. El `type` **no es editable**.

| Campo         | Tipo           | Notas                                         |
| ------------- | -------------- | --------------------------------------------- |
| `categoryId`  | UUID \| null   | —                                             |
| `amount`      | number         | Mín `0.01`. Recalcula balance automáticamente |
| `description` | string \| null | Máx 255 chars                                 |
| `date`        | ISO 8601       | —                                             |
| `reference`   | string \| null | Máx 255 chars                                 |

> **Restricción:** Las transacciones DEBT/LOAN con `status=SETTLED` solo permiten editar el `amount`. Otros campos no son editables mientras esté liquidada.
>
> **Restricción:** Al editar el monto de un DEBT/LOAN, el nuevo monto no puede ser menor que lo ya liquidado (pagos realizados). Ejemplo: deuda de 50 con pago de 40 → monto mínimo permitido es 40.
>
> **Transiciones de estado automáticas:**
> - Si al reducir el monto el `remainingAmount` llega a 0, la transacción pasa a `SETTLED`.
> - Si se aumenta el monto de una transacción `SETTLED`, vuelve a `PENDING` con el nuevo `remainingAmount`.

**Errores:**

- `404` — No encontrada
- `409` — No se puede modificar campos no-monto en transacción liquidada (`TXN_011`)
- `422` — El nuevo monto es menor que lo ya liquidado (`TXN_013`)

### `DELETE /transactions/:id`

Soft delete. Revierte el efecto en balance.

**Comportamiento especial:**

- Si es **DEBT/LOAN**: elimina todas las liquidaciones asociadas y revierte sus balances
- Si es una **liquidación** (tiene `relatedTransactionId`): revierte el `remainingAmount` del DEBT/LOAN original (puede cambiar de SETTLED a PENDING)

**Errores:**

- `403` — Pertenece a otro usuario
- `404` — No encontrada

### Respuesta de transacción (`TransactionResponseDto`)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "categoryId": "uuid | null",
  "type": "EXPENSE",
  "amount": 50.0,
  "description": "Almuerzo",
  "date": "2026-01-15T12:00:00.000Z",
  "destinationAccountId": null,
  "reference": null,
  "status": null,
  "relatedTransactionId": null,
  "remainingAmount": null,
  "createdAt": "2026-01-15T12:00:00.000Z",
  "updatedAt": "2026-01-15T12:00:00.000Z"
}
```

**Ejemplo DEBT pendiente:**

```json
{
  "id": "uuid-debt",
  "type": "DEBT",
  "amount": 100.0,
  "reference": "Juan Pérez",
  "status": "PENDING",
  "remainingAmount": 60.0,
  "relatedTransactionId": null
}
```

**Ejemplo liquidación:**

```json
{
  "id": "uuid-settlement",
  "type": "EXPENSE",
  "amount": 40.0,
  "reference": "Juan Pérez",
  "status": null,
  "remainingAmount": null,
  "relatedTransactionId": "uuid-debt"
}
```

---

## Habits

### `POST /habits`

Crea un nuevo hábito.

| Campo         | Tipo              | Requerido | Notas                                         |
| ------------- | ----------------- | --------- | --------------------------------------------- |
| `name`        | string            | sí        | Máx 100 chars. Único por usuario              |
| `frequency`   | HabitFrequency    | sí        | `DAILY` o `WEEKLY`                            |
| `description` | string \| null    | no        | Máx 500 chars                                 |
| `targetCount` | number            | no        | Default `1`. Mín `1`. Cantidad objetivo       |
| `color`       | string \| null    | no        | Máx 7 chars (hex: `#2196F3`)                  |
| `icon`        | string \| null    | no        | Máx 50 chars                                  |

**Response:** `201` — `HabitResponseDto`

**Errores:**

- `409` — Ya existe un hábito con ese nombre

### `GET /habits`

Lista hábitos del usuario con estadísticas (streak, completionRate, todayLog).

| Query param       | Tipo    | Descripción                         |
| ----------------- | ------- | ----------------------------------- |
| `includeArchived` | boolean | Si `true`, incluye hábitos archivados |

**Response:** `200` — `HabitResponseDto[]` (con stats)

### `GET /habits/daily`

Resumen diario: solo hábitos activos (no archivados) con su log de hoy y estadísticas. Ideal para la vista principal.

**Response:** `200` — `HabitResponseDto[]` (con stats)

### `GET /habits/:id`

Obtiene un hábito por UUID con estadísticas completas.

**Errores:**

- `403` — El hábito pertenece a otro usuario
- `404` — Hábito no encontrado

### `PATCH /habits/:id`

Actualiza campos del hábito. Solo se modifican los campos enviados.

| Campo         | Tipo              | Notas                          |
| ------------- | ----------------- | ------------------------------ |
| `name`        | string            | Máx 100 chars                  |
| `description` | string \| null    | Máx 500 chars                  |
| `frequency`   | HabitFrequency    | `DAILY` o `WEEKLY`             |
| `targetCount` | number            | Mín `1`                        |
| `color`       | string \| null    | Máx 7 chars                    |
| `icon`        | string \| null    | Máx 50 chars                   |

**Errores:**

- `404` — Hábito no encontrado
- `409` — Nombre ya en uso

### `PATCH /habits/:id/archive`

Archiva o desarchiva un hábito. No recibe body. Alterna el estado.

### `DELETE /habits/:id`

Soft delete. Elimina el hábito y todos sus logs asociados.

**Errores:**

- `404` — Hábito no encontrado

### `POST /habits/:id/logs`

Registra o actualiza el log de un hábito para una fecha. Si ya existe un log para esa fecha, lo actualiza (upsert).

| Campo         | Tipo           | Requerido | Notas                             |
| ------------- | -------------- | --------- | --------------------------------- |
| `date`        | string         | sí        | Formato `YYYY-MM-DD`. No futura  |
| `count`       | number         | sí        | Mín `0`. Cantidad realizada       |
| `targetCount` | number         | no        | Mín `1`. Objetivo de ESE día      |
| `note`        | string \| null | no        | Máx 500 chars                     |

**`targetCount` — objetivo por día.** Cada log guarda el suyo, así cambiar el
`targetCount` del hábito **no reescribe los días ya registrados**. Antes el
denominador se leía del hábito en vivo: subirlo de 3 a 4 convertía cada día ya
completado en «3/4».

Resolución cuando se omite, en este orden:

1. el `targetCount` que ya tenía ese log — **registrar de nuevo un día pasado no lo re-estampa** con el default de hoy;
2. si el log no existe, el `targetCount` del hábito.

Solo aplica a hábitos **DAILY**. En **WEEKLY** el objetivo es de la semana, no
del día, y se sigue midiendo contra el del hábito.

`completed` se calcula automáticamente: `count >= targetCount` del día. El
`count` se capea en ese target, por lo que un log completo cumple siempre
`count === targetCount`.

**Response:** `201` — `HabitLogResponseDto`

**Errores:**

- `404` — Hábito no encontrado
- `422` — Hábito archivado o fecha futura

### `GET /habits/:id/logs`

Historial de logs paginados.

| Query param | Tipo   | Descripción                                  |
| ----------- | ------ | -------------------------------------------- |
| `dateFrom`  | string | Fecha mínima (`YYYY-MM-DD`)                  |
| `dateTo`    | string | Fecha máxima (`YYYY-MM-DD`)                  |
| `page`      | number | Página (base 1, default: `1`)                |
| `limit`     | number | Items por página (default: `20`, máx: `100`) |

**Response:** `200` — `HabitLogResponseDto[]` con `meta` de paginación

### Respuesta de hábito (`HabitResponseDto`)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Tomar 8 vasos de agua",
  "description": "Beber al menos 8 vasos al día",
  "frequency": "DAILY",
  "targetCount": 8,
  "color": "#2196F3",
  "icon": "water",
  "isArchived": false,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "currentStreak": 5,
  "longestStreak": 15,
  "completionRate": 0.8,
  "todayLog": {
    "id": "uuid",
    "habitId": "uuid",
    "date": "2026-03-13",
    "count": 6,
    "completed": false,
    "note": null,
    "createdAt": "2026-03-13T10:00:00.000Z",
    "updatedAt": "2026-03-13T10:00:00.000Z"
  },
  "periodCount": 6,
  "periodCompleted": false,
  "periodTarget": 8
}
```

> **Nota:** `currentStreak`, `longestStreak`, `completionRate`, `todayLog`, `periodCount`, `periodCompleted` y `periodTarget` solo están presentes en los endpoints que devuelven stats (`GET /habits`, `GET /habits/daily`, `GET /habits/:id`). En `POST` y `PATCH` no se incluyen.
>
> **`periodTarget`**: el DENOMINADOR a mostrar. Es el objetivo contra el que se mide
> el período: en DAILY el del propio día (`todayLog.targetCount`), que puede diferir
> del `targetCount` del hábito; en WEEKLY siempre el del hábito. **Usá siempre este
> campo para renderizar `periodCount / X`** — leer `targetCount` del hábito reescribe
> visualmente los días pasados.
>
> **`periodCount`**: Conteo acumulado en el período actual. Para hábitos DAILY es el count de hoy; para WEEKLY es la suma de counts de la semana actual (lunes a domingo ISO).
>
> **`periodCompleted`**: `true` si `periodCount >= targetCount`. Permite saber si la meta del período ya se cumplió, especialmente útil para hábitos semanales donde `todayLog` puede no existir pero la semana ya está completa.
>
> **Límite de count**: Al registrar un log, el `count` se limita automáticamente al `targetCount` del hábito. Si se envía un valor mayor, se guarda `targetCount`.

### Respuesta de log (`HabitLogResponseDto`)

```json
{
  "id": "uuid",
  "habitId": "uuid",
  "date": "2026-03-13",
  "count": 5,
  "completed": false,
  "note": "Buen día",
  "createdAt": "2026-03-13T10:00:00.000Z",
  "updatedAt": "2026-03-13T10:00:00.000Z"
}
```

---

## Quick Tasks (Diarias)

TODOs cortas "para hoy". Se eliminan automáticamente al día siguiente **si fueron completadas**; las pendientes persisten indefinidamente. La lógica de "día siguiente" usa la timezone del usuario (`user_settings.timezone`, default `'UTC'`).

> **Hard delete:** A diferencia del resto del proyecto (soft delete), las quick-tasks se borran físicamente. Excepción deliberada por la naturaleza efímera del módulo.

### `GET /quick-tasks`

Lista las tareas del usuario, ordenadas por `position ASC, createdAt ASC`. Antes de responder, **ejecuta un lazy cleanup**: elimina las tareas completadas cuyo `completedAt` sea anterior al inicio del día del usuario.

**Response:** `200` — `QuickTaskResponseDto[]`

### `POST /quick-tasks`

Crea una tarea nueva. Se agrega al final (`position = maxPosition + 1`).

| Campo         | Tipo           | Requerido | Notas                                   |
| ------------- | -------------- | --------- | --------------------------------------- |
| `title`       | string         | sí        | Máx 120 chars                           |
| `description` | string \| null | no        | Markdown, máx 5000 chars                |

**Response:** `201` — `QuickTaskResponseDto`

**Errores:**

- `422` — Título vacío (`QTK_003`) o fuera de rango (`QTK_004`/`QTK_005`)

### `PATCH /quick-tasks/:id`

Actualiza título, descripción y/o estado de completado. Togglear `completed` a `true` setea `completedAt = now`; a `false` limpia el timestamp (la tarea sobrevive al cleanup del día siguiente).

| Campo         | Tipo           | Notas                                      |
| ------------- | -------------- | ------------------------------------------ |
| `title`       | string         | Máx 120 chars                              |
| `description` | string \| null | Enviar `null` explícito para limpiar       |
| `completed`   | boolean        | Al completar, `completedAt` se setea solo  |

Todos los campos son opcionales.

**Response:** `200` — `QuickTaskResponseDto`

**Errores:**

- `404` — Tarea no encontrada
- `403` — Tarea pertenece a otro usuario

### `DELETE /quick-tasks/:id`

**Hard delete.**

**Response:** `204 No Content`

**Errores:**

- `404` — Tarea no encontrada
- `403` — Tarea pertenece a otro usuario

### `PATCH /quick-tasks/reorder`

Renumera las posiciones según el orden de `orderedIds`. Todas las ids deben pertenecer al usuario autenticado. Ids no listadas mantienen su posición.

| Campo        | Tipo     | Requerido | Notas                                    |
| ------------ | -------- | --------- | ---------------------------------------- |
| `orderedIds` | UUID[]   | sí        | Mínimo 1 elemento. Se reasignan 1..N    |

**Response:** `204 No Content`

**Errores:**

- `422` — Alguna id no pertenece al usuario (`QTK_006`)

### Respuesta de tarea (`QuickTaskResponseDto`)

```json
{
  "id": "uuid",
  "title": "Comprar leche",
  "description": "Fresca del mercado",
  "completed": false,
  "completedAt": null,
  "position": 1,
  "createdAt": "2026-04-20T00:00:00.000Z",
  "updatedAt": "2026-04-20T00:00:00.000Z"
}
```

---

## Reports (Dashboards)

Endpoints agregados para las pantallas de reportes. Cada endpoint acepta `?period=week|30d|month|3m` (default `month`). Los valores se documentan en [enums.md](enums.md#reportperiod).

Rangos:

- `week` — últimos 7 días (deslizante)
- `30d` — últimos 30 días (deslizante)
- `month` — mes calendario actual en la timezone del usuario (desde el 1° a las 00:00 locales, hasta `now`)
- `3m` — mes actual + los dos meses anteriores

### `GET /reports/finances-dashboard?period=...`

Devuelve agregados financieros agrupados **por moneda** (nunca se suman cuentas de monedas distintas).

**Response:** `200` — `FinancesDashboardResponseDto`

```json
{
  "period": "month",
  "range": { "from": "2026-04-01T05:00:00.000Z", "to": "2026-04-20T15:00:00.000Z" },
  "totalBalance": [
    { "currency": "PEN", "amount": 1520.5, "accountCount": 3 }
  ],
  "periodFlow": [
    { "currency": "PEN", "income": 3000, "expense": 2400, "net": 600 }
  ],
  "topExpenseCategories": [
    {
      "categoryId": "uuid",
      "name": "Comida",
      "color": "#FF5722",
      "currency": "PEN",
      "total": 420.75,
      "percentage": 28.5
    }
  ],
  "dailyFlow": [
    {
      "currency": "PEN",
      "points": [{ "date": "2026-04-15", "income": 120, "expense": 85 }]
    }
  ],
  "pendingDebts": [
    { "currency": "PEN", "owesYou": 300, "youOwe": 120, "net": 180 }
  ]
}
```

- `topExpenseCategories[].percentage`: porcentaje del total de EXPENSE para esa moneda (0–100). Máximo 5 categorías.
- `dailyFlow[].points`: una entrada por día del rango con actividad. `date` es `YYYY-MM-DD` en UTC.
- `pendingDebts`: reutiliza `aggregateDebtsByReference` con filtro `pending` y lo colapsa por moneda.

### `GET /reports/routines-dashboard?period=...`

Devuelve agregados de hábitos + tareas diarias. Las métricas "hoy" usan la timezone del usuario independientemente del período.

**Response:** `200` — `RoutinesDashboardResponseDto`

```json
{
  "period": "month",
  "range": { "from": "2026-04-01T05:00:00.000Z", "to": "2026-04-20T15:00:00.000Z" },
  "topHabitStreaks": [
    {
      "habitId": "uuid",
      "name": "Tomar agua",
      "color": "#2196F3",
      "frequency": "DAILY",
      "currentStreak": 5,
      "longestStreak": 12,
      "completionRate": 0.83
    }
  ],
  "habitCompletionToday": { "completedToday": 3, "dueToday": 5, "rate": 0.6 },
  "quickTasksToday": { "completed": 2, "pending": 1, "total": 3 }
}
```

- `topHabitStreaks`: hasta 5 hábitos ordenados por `currentStreak DESC` y desempatados por `longestStreak`. Usa el mismo `StatsCalculator` que `GET /habits`, así los números coinciden con la página de hábitos.
- `habitCompletionToday`: solo cuenta hábitos DAILY (los WEEKLY no encajan en una métrica diaria).
- `quickTasksToday`: refleja el estado actual del día en la timezone del usuario.

---

## Monthly Services

Servicios mensuales recurrentes (Netflix, gym, internet). El sistema no cobra automáticamente —
el usuario marca "pagar" y se crea un `Transaction EXPENSE` vinculado al servicio. Los períodos
se manejan como `YYYY-MM`. `nextDuePeriod`, `isOverdue`, `isPaidForCurrentMonth` y
`paidAmountForCurrentMonth` son campos calculados en cada respuesta, relativos al mes actual en
la timezone del header `x-timezone`.

**Importante**: la moneda del servicio es inmutable y debe coincidir con la cuenta por defecto.
`startPeriod` tampoco es editable una vez creado.

### `GET /monthly-services?includeArchived=bool`

Lista los servicios activos del usuario. `includeArchived=true` trae también los archivados.

- **Query:**
  - `includeArchived` — `boolean` opcional (default `false`)
- **Response:** `200` — `MonthlyServiceResponseDto[]`

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Netflix",
    "defaultAccountId": "uuid",
    "categoryId": "uuid",
    "currency": "PEN",
    "frequencyMonths": 1,
    "estimatedAmount": 45.0,
    "dueDay": 15,
    "startPeriod": "2026-01",
    "lastPaidPeriod": "2026-03",
    "isActive": true,
    "nextDuePeriod": "2026-04",
    "isOverdue": false,
    "isPaidForCurrentMonth": false,
    "paidAmountForCurrentMonth": 35.0,
    "linkedDebts": [
      {
        "id": "uuid",
        "reference": "Ana",
        "remainingAmount": 100.0,
        "status": "PENDING"
      }
    ],
    "createdAt": "2026-01-05T12:00:00.000Z",
    "updatedAt": "2026-04-01T20:10:00.000Z"
  }
]
```

**`paidAmountForCurrentMonth`** (number, default `0`): suma de transacciones `EXPENSE` vinculadas
a este servicio (vía `monthly_service_id`) durante el mes calendario actual en la timezone del
cliente. Driver del KPI "Pagado / Estimado" en el dashboard de servicios.

> Solo se popula con valor exacto en la **list response** (`GET /monthly-services`). Las demás
> endpoints (`GET /:id`, `POST`, `PATCH`, `POST /:id/pay`, `POST /:id/skip`, `PATCH /:id/archive`)
> emiten `0` — la list response es la única que necesita el cálculo y evita la query extra en el
> resto de los endpoints. Si el frontend necesita el monto fresco post-pago, debe re-fetchear la
> lista.

**`linkedDebts`** (array, siempre presente — `[]` si el servicio no tiene préstamos vinculados):
préstamos (`LOAN`, módulo Deudas/Préstamos) generados por pagos compartidos de este servicio
(`sourceMonthlyServicePaymentId`), agrupados por todos los pagos del servicio. Solo incluye los que
siguen `PENDING` — los `SETTLED` dejan de listarse acá (siguen visibles como historial en
`GET /debts`). Cada ítem: `id` (UUID del `DebtLoan`, usar para `POST /debts/:id/settle`),
`reference` (nombre de la persona, tal cual se guardó — sin normalizar), `remainingAmount`,
`status` (siempre `'PENDING'` en este array). Se popula con valor exacto en `GET /monthly-services`
(list) y `GET /monthly-services/:id` (detalle) — mismo patrón que `paidAmountForCurrentMonth`. El
resto de endpoints (`POST`, `PATCH`, `POST /:id/skip`, `PATCH /:id/archive`) emiten `[]` — no
necesitan el cálculo extra y un `POST` (creación) estructuralmente no puede tener préstamos
vinculados todavía.

### `GET /monthly-services/:id`

Detalle de un servicio.

- **Response:** `200` — `MonthlyServiceResponseDto`
- `404 MSVC_002` si no existe o pertenece a otro usuario.

### `POST /monthly-services`

Crea un servicio. La moneda debe coincidir con la cuenta por defecto.
`startPeriod` es opcional — si se omite, se usa el mes actual en la timezone del header `x-timezone`.

- **Body:**

```json
{
  "name": "Netflix",
  "defaultAccountId": "uuid",
  "categoryId": "uuid",
  "currency": "PEN",
  "frequencyMonths": 1,
  "estimatedAmount": 45.0,
  "dueDay": 15,
  "startPeriod": "2026-04",
  "participants": [
    { "reference": "Ana", "defaultAmount": 20.0 },
    { "reference": "Luis", "defaultAmount": 15.0 }
  ]
}
```

`frequencyMonths` defaults to `1` (monthly). Allowed values: `1, 3, 6, 12` (mensual, trimestral, semestral, anual). **Inmutable** — no se puede cambiar después de crear el servicio.

`participants` es OPCIONAL — mismo shape y mismas validaciones que
`PUT /monthly-services/:id/participants` (referencia normalizada única dentro del array,
`defaultAmount > 0`, `sum(defaultAmount) ≤ estimatedAmount` cuando este último está definido).
Cuando se envía (y es no vacío), el servicio y sus participantes se crean atómicamente en una sola
transacción — si algún participante es inválido, la creación del servicio se revierte por
completo (no queda un servicio sin participantes ni un estado parcial). Omitir el campo o enviar
`[]` crea el servicio exactamente igual que antes de esta funcionalidad (sin cambios de
comportamiento).

- **Response:** `201` — `MonthlyServiceResponseDto`
- `404 ACC_001` si la cuenta no existe o no es tuya.
- `404 CAT_001` si la categoría no existe o no es tuya.
- `409 MSVC_003` si ya tenés un servicio activo con ese nombre.
- `409 MSP_PARTICIPANT_DUPLICATE_REFERENCE` referencias duplicadas dentro de `participants[]`.
- `422 VAL_002` si la moneda del DTO no coincide con la cuenta.
- `422 MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED` la suma de `participants[].defaultAmount` supera `estimatedAmount`.
- `422 MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE` algún `participants[].defaultAmount` ≤ 0.

### `PATCH /monthly-services/:id`

Edita los campos permitidos. **No se puede cambiar** `currency`, `startPeriod` ni `frequencyMonths`.

- **Body (todos opcionales):** `name`, `defaultAccountId`, `categoryId`, `estimatedAmount`, `dueDay`.
- **Response:** `200` — `MonthlyServiceResponseDto`
- `404 MSVC_002` / `404 ACC_001` / `404 CAT_001`
- `409 MSVC_003` si el nuevo nombre está tomado por otro servicio activo.
- `422 VAL_002` si la nueva cuenta tiene distinta moneda.

### `POST /monthly-services/:id/pay`

Registra un pago del servicio:

1. Crea un `Transaction` de tipo `EXPENSE` con `monthlyServiceId` = `:id`.
2. Debita la cuenta (override si se envía `accountIdOverride`, default si no).
3. Avanza `lastPaidPeriod` al período recién facturado.
4. Actualiza `estimatedAmount` al monto del último pago registrado del servicio.

- **Body:**

```json
{
  "amount": 42.9,
  "date": "2026-04-21T12:00:00Z",
  "description": "Netflix abril",
  "accountIdOverride": "uuid"
}
```

`date` default = ahora. `description` default = nombre del servicio.

- **Response:** `201` — `{ service: MonthlyServiceResponseDto, transaction: TransactionResponseDto }`
- `404 MSVC_002` servicio no encontrado.
- `404 ACC_001` cuenta de pago no encontrada.
- `409 MSVC_004` el servicio ya está pagado para el mes actual (idempotency guard — evita duplicar transacciones).
- `422 VAL_002` monedas incompatibles.

### `POST /monthly-services/:id/skip`

Avanza `lastPaidPeriod` al próximo período **sin** crear transacción ni afectar balance. Útil
para meses gratuitos o pausas del servicio.

- **Body:** `{ reason?: string }` — sólo metadato para el log del backend, no se persiste.
- **Response:** `200` — `MonthlyServiceResponseDto`
- `404 MSVC_002`

### `PATCH /monthly-services/:id/archive`

Toggle de `isActive`. Archivar un servicio NO afecta las transacciones históricas vinculadas.

- **Response:** `200` — `MonthlyServiceResponseDto`
- `404 MSVC_002`

### `DELETE /monthly-services/:id`

Soft-delete (marca `deletedAt = now()`), **sólo** si el servicio no tiene pagos registrados. Si los tiene, hay que archivarlo.

- **Response:** `204 No Content`
- `404 MSVC_002` servicio no encontrado.
- `409 MSVC_001` servicio con pagos — no se puede eliminar.

### Participantes de servicios compartidos

Un servicio mensual puede tener una lista opcional de participantes configurados (ver batch
replace abajo) Y/o recibir splits ad-hoc en cada pago (`participants[]` en
`POST /monthly-service-payments`, ver esa sección). La configuración es sólo un default sugerido
— el pago puede usar montos distintos sin tocar la config.

Un servicio mensual puede tener una lista opcional de participantes. Cada participante referencia
un valor `debts_loans.reference` (normalizado internamente: trim + minúsculas + sin acentos) y un
monto por defecto fijo. No puede haber dos participantes con la misma referencia normalizada en un
mismo servicio. Si el servicio tiene `estimatedAmount`, la suma de los montos por defecto no puede
superarlo.

**Modelo de edición: batch replace.** La configuración se administra con un único endpoint
`PUT` que reemplaza la lista COMPLETA — no hay endpoints de agregar/editar/quitar uno por uno. El
frontend muestra filas editables y un botón "Guardar" que persiste la lista entera de una vez. El
array enviado ES el set activo final: lo que no está en el array se da de baja.

También se puede configurar la lista inicial de participantes directamente al crear el servicio
(`participants[]` en `POST /monthly-services`, ver esa sección).

#### `PUT /monthly-services/:id/participants`

Reemplaza toda la configuración de participantes del servicio. NO es incremental — el array
enviado ES la lista activa final.

- **Body:**

```json
{
  "participants": [
    { "reference": "Ana", "defaultAmount": 120.0 },
    { "reference": "Marta", "defaultAmount": 60.0 }
  ]
}
```

- **Comportamiento (diff por referencia normalizada, todo en una sola transacción):**
  - Un participante activo cuya referencia normalizada SÍ está en el array recibido: se
    actualiza (`defaultAmount` y `reference` crudo), conservando su `id`/`createdAt`.
  - Un participante activo cuya referencia normalizada NO está en el array recibido: se da de
    baja (soft-delete).
  - Una referencia normalizada nueva (no existía como participante activo): se inserta.
  - Array vacío (`{ "participants": [] }`) = quita todos los participantes configurados (vuelve a
    comportarse como servicio no compartido).
- **Response:** `200` — `MonthlyServiceParticipantResponseDto[]` (la lista resultante tras el
  reemplazo).
- `404 MSVC_002` servicio no encontrado o de otro usuario.
- `409 MSP_PARTICIPANT_DUPLICATE_REFERENCE` referencias duplicadas DENTRO del mismo envío
  (normalizadas), o una carrera de unicidad contra la base de datos.
- `422 MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED` la suma de `defaultAmount` del array supera
  `estimatedAmount` del servicio.
- `422 MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE` algún `defaultAmount` ≤ 0.

#### `GET /monthly-services/:id/participants`

Lista los participantes configurados para el servicio.

- **Response:** `200` — `MonthlyServiceParticipantResponseDto[]`
- `404 MSVC_002` servicio no encontrado o de otro usuario.

```json
{
  "id": "uuid",
  "monthlyServiceId": "uuid",
  "userId": "uuid",
  "reference": "Ana",
  "defaultAmount": 100.0,
  "createdAt": "2026-07-27T12:00:00.000Z",
  "updatedAt": "2026-07-27T12:00:00.000Z"
}
```

---

## Chores

Tareas recurrentes no diarias (lavar sábanas, rotar neumáticos, vaciar la pelusera del secarropas, etc.).
A diferencia de los hábitos diarios, las chores tienen una **cadencia libre** definida como
`(intervalValue, intervalUnit)` donde `intervalUnit` es uno de `days | weeks | months | years`.

Cada chore conoce su próxima fecha (`nextDueDate`, formato `YYYY-MM-DD`). Marcarla como hecha crea
un `ChoreLog` y avanza `nextDueDate` a `doneAt + interval` (la cadencia se reanuda desde la fecha real
de hecho). Saltear un ciclo avanza `nextDueDate` sin crear log y sin tocar `lastDoneDate`.

`isOverdue` se calcula contra "hoy" en la timezone del header `x-timezone`.

### `GET /chores?includeArchived=bool`

Lista las chores activas del usuario. `includeArchived=true` incluye también las archivadas.

- **Query:**
  - `includeArchived` — `boolean` opcional (default `false`)
- **Response:** `200` — `ChoreResponseDto[]`

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Lavar sábanas",
    "notes": "Programa 60°C",
    "category": "Limpieza",
    "intervalValue": 2,
    "intervalUnit": "weeks",
    "startDate": "2026-04-01",
    "lastDoneDate": "2026-04-15",
    "nextDueDate": "2026-04-29",
    "isActive": true,
    "isOverdue": false,
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-04-15T20:30:00.000Z"
  }
]
```

### `GET /chores/:id`

Detalle de una chore.

- **Response:** `200` — `ChoreResponseDto`
- `404 CHRE_002` si no existe o pertenece a otro usuario.

### `GET /chores/:id/logs?limit=20&offset=0`

Lista paginada de eventos (logs) de la chore. Orden: `doneAt DESC, createdAt DESC` (más recientes primero).

- **Query:**
  - `limit` — `number` opcional, default `20`, max `100`.
  - `offset` — `number` opcional, default `0`.
- **Response:** `200` — `ChoreLogResponseDto[]` con `meta` paginada.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "choreId": "uuid",
      "doneAt": "2026-04-15",
      "note": "Usé desinfectante nuevo",
      "createdAt": "2026-04-15T20:30:00.000Z"
    }
  ],
  "message": "Eventos obtenidos exitosamente",
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

- `404 CHRE_002` si la chore no existe o pertenece a otro usuario.

### `POST /chores`

Crea una chore. `nextDueDate` se inicializa al `startDate`. `lastDoneDate` queda en `null`.

- **Body:**

```json
{
  "name": "Lavar sábanas",
  "notes": "Programa 60°C",
  "category": "Limpieza",
  "intervalValue": 2,
  "intervalUnit": "weeks",
  "startDate": "2026-04-15"
}
```

- `name` requerido (1..100 chars). `notes` opcional (≤2000 chars). `category` opcional (≤50 chars).
- `intervalValue` requerido, entero positivo. `intervalUnit` requerido, ver
  [`IntervalUnit`](enums.md#intervalunit).
- `startDate` requerido, formato `YYYY-MM-DD`.
- **Response:** `201` — `ChoreResponseDto`

### `PATCH /chores/:id`

Edita los campos permitidos. **No se puede cambiar** `startDate` (semilla de la primera cadencia).

- **Body (todos opcionales):** `name`, `notes`, `category`, `intervalValue`, `intervalUnit`,
  `nextDueDate`.
- **Importante:** cambiar `intervalValue` o `intervalUnit` **NO** recalcula `nextDueDate`
  automáticamente. Si querés desplazar el próximo vencimiento, mandalo explícitamente vía
  `nextDueDate` en el mismo PATCH.
- **Response:** `200` — `ChoreResponseDto`
- `404 CHRE_002` si no existe o pertenece a otro usuario.

### `POST /chores/:id/done`

Marca la chore como hecha:

1. Crea un `ChoreLog` con `doneAt` (default = hoy en la timezone del cliente) y `note?`.
2. Setea `lastDoneDate = doneAt`.
3. Avanza `nextDueDate = doneAt + interval` (regla A — la cadencia se reanuda desde la fecha real
   de hecho).

- **Body:**

```json
{
  "doneAt": "2026-04-15",
  "note": "Usé desinfectante nuevo"
}
```

- `doneAt` opcional (formato `YYYY-MM-DD`); si falta, se usa el día actual en la timezone del header
  `x-timezone`.
- `note` opcional (≤500 chars).
- **Response:** `201` — `{ chore: ChoreResponseDto, log: ChoreLogResponseDto }`
- `404 CHRE_002` si no existe o pertenece a otro usuario.

### `POST /chores/:id/revert-last-done`

Deshace la **última** marca de "hecho" (undo de un mark-done equivocado). Soft-deletea el `ChoreLog`
más reciente (no borrado) de la chore y reconstruye la chore al estado previo a ese "hecho":

1. Ubica el `ChoreLog` más reciente no borrado (orden `doneAt DESC, createdAt DESC`).
2. Lo soft-deletea (`deletedAt = now()`), por lo que deja de aparecer en `GET /chores/:id/logs`.
3. Recalcula la chore:
   - Si queda un log anterior: `lastDoneDate = doneAt del log anterior` y
     `nextDueDate = ese doneAt + interval`.
   - Si no quedan logs: `lastDoneDate = null` y `nextDueDate = startDate`.

Toda la secuencia leer-decidir-escribir (re-lectura de la chore con lock de fila, búsqueda del último
log, soft-delete y guardado) ocurre en una **única transacción** con un lock `pessimistic_write` sobre
la row de la chore, de modo que dos reverts concurrentes o duplicados (doble-tap, reintento) se
serializan: el segundo espera al commit del primero y recién ahí deshace el "hecho" siguiente. Sólo se
puede revertir el **último** evento — no hay revert de logs arbitrarios. Revertir dos veces deshace dos
"hechos".

> **Interacción con `skip`.** El revert **recalcula por completo** `nextDueDate` a partir de la última
> completación que queda (o de `startDate` si no queda ninguna) — el estado revertido se deriva
> puramente del historial de "hechos". Como los `skip` no crean log, **un `skip` hecho DESPUÉS del
> último `done` pierde su efecto sobre `nextDueDate`** al revertir: el avance del skip se descarta. Es
> decir, `markDone(D1) → skip() → revert-last-done` deja la chore en el estado derivado de `D1` (o de
> `startDate` si `D1` era la única completación), NO en el `nextDueDate` que había dejado el skip.

- **Body:** ninguno.
- **Response:** `200` — `ChoreResponseDto` (la chore actualizada).
- `404 CHRE_002` si no existe o pertenece a otro usuario.
- `409 CHRE_003` si la chore no tiene ningún log para revertir.

### `POST /chores/:id/skip`

Avanza `nextDueDate += interval` **sin** crear log y **sin** modificar `lastDoneDate`. Útil cuando
el usuario quiere correr el próximo vencimiento un ciclo sin afirmar que la hizo.

- **Body:** `{}` (vacío en v1).
- **Response:** `200` — `ChoreResponseDto`
- `404 CHRE_002` si no existe o pertenece a otro usuario.

### `PATCH /chores/:id/archive`

Toggle de `isActive`. Archivar una chore **NO** afecta los logs históricos.

- **Response:** `200` — `ChoreResponseDto`
- `404 CHRE_002`

### `DELETE /chores/:id`

Soft-delete (marca `deletedAt = now()`), **sólo** si la chore no tiene logs. Si los tiene,
archivala con `PATCH /:id/archive`.

- **Response:** `204 No Content`
- `404 CHRE_002` chore no encontrada.
- `409 CHRE_001` chore con eventos registrados — no se puede eliminar.

## Budgets

Presupuestos mensuales de gastos discrecionales. Un budget cubre **una** combinación
`(year, month, currency)` por usuario. Los **movimientos del budget** son transactions
EXPENSE con `budgetId` apuntando al budget — NO se cuentan todos los expenses del mes,
sólo los que el usuario explícitamente registra desde el budget. Esto permite separar
"plata para gastar libre" del resto del flujo financiero.

- Cada movimiento debita la cuenta elegida en la moneda del budget.
- Borrar el budget no borra sus movimientos: nullea `transaction.budgetId` y los expenses
  sobreviven en `/transactions` como gastos normales.

Todos los endpoints requieren `Authorization: Bearer <accessToken>`.

### `GET /budgets`

Lista todos los budgets del usuario (sin KPI, sin movimientos). Vista de historial.

- **Response:** `200` — `BudgetResponseDto[]` ordenado por `year DESC, month DESC, currency ASC`.

### `GET /budgets/current?currency=PEN`

Devuelve el budget del **mes actual** para la moneda dada, con KPI y movimientos.

- El año/mes se calculan desde el header `x-timezone` (timezone del cliente).
- Si no existe budget para ese mes+moneda, devuelve **`200` con `data: null`** — la UI
  renderiza CTA "crear budget" en ese caso (no es un error).
- **Query params:** `currency` (`PEN | USD | EUR`) — requerido.
- **Response:** `200` — `BudgetWithKpiResponseDto | null`.

### `GET /budgets/:id`

Detalle de un budget específico (pasado, presente o futuro), con KPI y movimientos.

- **Response:** `200` — `BudgetWithKpiResponseDto`.
- `404 BDGT_001` si no existe o pertenece a otro usuario.

```json
{
  "id": "uuid",
  "userId": "uuid",
  "year": 2026,
  "month": 4,
  "currency": "PEN",
  "amount": 2000,
  "spent": 450,
  "remaining": 1550,
  "daysRemainingIncludingToday": 16,
  "dailyAllowance": 96.88,
  "initialDailyAllowance": 66.67,
  "recovery": { "zeroSpendDays": 0, "halfSpendDays": 0 },
  "currentDate": "2026-04-15",
  "movements": [
    {
      "id": "uuid",
      "type": "EXPENSE",
      "amount": 50,
      "date": "2026-04-15T12:00:00.000Z",
      "categoryId": "uuid",
      "accountId": "uuid",
      "description": "Cena con amigos",
      "budgetId": "uuid"
    }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

**KPI**:

- `spent` = suma de `amount` de las transactions linkeadas al budget (no de todos los expenses
  del mes).
- `remaining = amount - spent` (puede ser negativo si el usuario se pasó).
- `daysRemainingIncludingToday`:
  - Mes activo: `lastDayOfMonth - today + 1` (incluye hoy).
  - Mes pasado: `0`.
  - Mes futuro: días totales del mes.
- `dailyAllowance = round2(remaining / daysRemainingIncludingToday)`. **`null`** cuando
  `daysRemaining = 0` (mes ya cerrado).
- `initialDailyAllowance = round2(amount / díasDelMes)` — el diario con el que arrancó el mes.
  **`null`** cuando el mes ya cerró.
- `recovery` — plan de recuperación (ver abajo). **`null`** cuando el mes ya cerró.
- `currentDate` = `YYYY-MM-DD` en la timezone del cliente.

#### Plan de recuperación (`recovery`)

`dailyAllowance` se recalcula vivo, así que ya se auto-corrige: te pasás hoy y mañana baja.
`recovery` responde la pregunta inversa — **cuántos días de contención hacen falta para que
vuelva a `initialDailyAllowance`**.

Con `A` = amount, `D` = días del mes, `R` = remaining, `d` = días restantes incluyendo hoy,
y `a₀ = A/D`:

Gastar 0 durante `k` días deja el mismo `R` repartido en `d − k` días, así que el diario
sube a `R / (d − k)`. Pidiendo que eso alcance `a₀`:

```
k₀ = ceil(d − R·D/A)
```

Y gastar una fracción `f` de `a₀` en vez de nada estira el mismo resultado a `k₀ / (1 − f)`.
Por eso **gastar la mitad cuesta exactamente el doble de días**, y `halfSpendDays` se deriva
en vez de resolverse de nuevo.

| Campo | Significado |
| ----- | ----------- |
| `zeroSpendDays` | Días enteros gastando 0. **`null`** si no entra en los días que quedan |
| `halfSpendDays` | Días enteros gastando `a₀/2` — el doble. **`null`** si no entra |

**Cada plan se valida por separado.** El de la mitad es el doble de largo, así que se queda
sin mes antes: con 12 días restantes, un plan de 7 días en cero es alcanzable pero su gemelo
de 14 gastando la mitad no. Reportarlo igual producía cosas como *"18 días gastando la mitad"*
un día con 12 restantes.

Ojo con `0` vs `null` en `zeroSpendDays`: **`0` = no hay nada que recuperar** (estás en ritmo
o adelantado), **`null` = no se recupera este mes**. Son respuestas distintas y la UI las
muestra distinto.

Ejemplo: budget 3000 en abril (30 días) → `a₀ = 100`. El día 10 con 1500 gastados:
`R = 1500`, `d = 21`, diario actual `71.43`. Entonces `k₀ = 21 − 15 = 6` días en cero
(1500/15 = 100 exacto) o 12 días gastando 50.

Se redondea **hacia arriba**: medio día de contención no te deja ahí.

Con los dos en `null` hay que mostrar "no se recupera este mes", no un número: un plan que
iguala o supera `d` no deja ningún día para efectivamente gastar el diario recuperado. Un
budget ya excedido (`remaining` negativo) cae también acá.

### `POST /budgets`

Crea un budget para `(year, month, currency)`.

- **Body:**

```json
{
  "year": 2026,
  "month": 4,
  "currency": "PEN",
  "amount": 2000
}
```

- `year` y `month` opcionales — si se omiten, se usa el mes actual en la timezone del header
  `x-timezone`.
- `currency` requerido (`PEN | USD | EUR`); inmutable después de crear.
- `amount` > 0, máx 2 decimales.
- **Response:** `201` — `BudgetResponseDto`.
- `409 BDGT_002` si ya existe un budget activo para esa combinación.

### `PATCH /budgets/:id`

Edita el `amount` de un budget. **Único campo editable** — `year`, `month`, `currency` son
inmutables (cambiarlos rompería los movimientos linkeados).

- **Body:** `{ "amount": 2500 }`
- **Response:** `200` — `BudgetResponseDto`.
- `404 BDGT_001`

### `DELETE /budgets/:id`

Soft-delete del budget + nullea `budgetId` en todas las transactions linkeadas. Las
transactions sobreviven como gastos normales en `/transactions`.

- **Response:** `204 No Content`
- `404 BDGT_001`

### `POST /budgets/:id/movements`

Registra un movimiento del budget — crea una transacción EXPENSE con `budgetId`,
debita la cuenta elegida.

- **Body:**

```json
{
  "amount": 50,
  "accountId": "uuid",
  "categoryId": "uuid",
  "date": "2026-04-15T12:00:00.000Z",
  "description": "Cena"
}
```

- `amount` > 0, máx 2 decimales.
- `accountId`: cuenta del usuario; su `currency` debe coincidir con la del budget.
- `categoryId`: categoría del usuario (catálogo global).
- `date`: debe caer **dentro del mes calendario del budget**.
- `description` opcional (≤255 chars).
- **Response:** `201` — `{ transaction: TransactionResponseDto }`.
- `404 BDGT_001` budget no encontrado.
- `404 ACC_001` cuenta no encontrada o ajena.
- `404 CAT_001` categoría no encontrada o ajena.
- `422 VAL_002` (`CURRENCY_MISMATCH`) cuenta en otra moneda que el budget.
- `422 BDGT_003` (`MOVEMENT_DATE_OUT_OF_RANGE`) fecha fuera del mes del budget.

> **Nota:** los movimientos se editan/eliminan vía los endpoints normales de
> `/transactions/:id` (`PATCH`/`DELETE`). El campo `budgetId` aparece en el
> `TransactionResponseDto` para que la UI pueda diferenciar "movimiento de budget"
> vs "expense normal" en el listado general.

## Tasks + Sections

Módulo de TODOs estilo proyectos. Las **secciones** agrupan tasks (drag-and-drop
restringido a la misma sección — para mover una task entre secciones se usa el
form de edit). Cleanup semanal: tasks completadas con
`completedAt < startOfWeek` (en TZ + setting `startOfWeek` del usuario) se
hard-deletean lazy en cada `GET /tasks`. Tasks incompletas sobreviven entre
semanas.

Todos los endpoints requieren `Authorization: Bearer <accessToken>`.

### `GET /tasks/sections`

Lista las secciones del usuario, ordenadas por `position` ASC.

- **Response:** `200` — `SectionResponseDto[]`.

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Trabajo",
  "color": "#FF6B35",
  "position": 1,
  "isCollapsed": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `POST /tasks/sections`

- **Body:** `{ "name": "Trabajo", "color": "#FF6B35" }` (`color` opcional, debe ser `#RRGGBB`).
- **Response:** `201` — `SectionResponseDto`. La sección se agrega al final del orden, expandida (`isCollapsed: false`).

### `PATCH /tasks/sections/:id`

- **Body:** `{ "name"?, "color"?, "isCollapsed"? }` (`color: null` lo limpia).
- `isCollapsed` persiste el estado del header en el dashboard de tareas — el frontend lo togglea con optimistic update y este endpoint confirma.
- **Response:** `200` — `SectionResponseDto`.
- `404 TSK_001`.

### `DELETE /tasks/sections/:id`

**CASCADE** — borra la sección Y todas las tasks dentro (FK `ON DELETE CASCADE`). El
frontend muestra un confirm con el conteo de tasks antes de invocar.

- **Response:** `204 No Content`.
- `404 TSK_001`.

### `PATCH /tasks/sections/reorder`

- **Body:** `{ "orderedIds": ["id1", "id2", ...] }`. Reasigna `position` 1..N.
- **Response:** `204 No Content`.
- `422 TSK_004` cuando algún ID no existe o no es del usuario.

### `GET /tasks`

Lista las tasks del usuario, **con cleanup lazy**: antes de devolver, se hard-deletean
las tasks completadas cuyo `completedAt < startOfWeek` (en TZ + setting `startOfWeek`).

Resultado ordenado por `(section.position, task.position, task.createdAt)` para que la
UI las renderice agrupadas por sección sin re-orden client-side.

- **Response:** `200` — `TaskResponseDto[]`.

```json
{
  "id": "uuid",
  "userId": "uuid",
  "sectionId": "uuid",
  "title": "Llamar al banco",
  "description": "## Notas\n- preguntar por la tarjeta",
  "completed": false,
  "completedAt": null,
  "position": 1,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `POST /tasks`

- **Body:** `{ "sectionId": "uuid", "title": "...", "description"? }`.
- `description` opcional (markdown, ≤5000 chars).
- **Response:** `201` — `TaskResponseDto`. La task se agrega al final del orden de la sección.
- `404 TSK_001` sección no encontrada o ajena.

### `PATCH /tasks/:id`

Edita campos de la task. Cualquier subset es válido.

- **Body:** `{ "title"?, "description"?, "completed"?, "sectionId"? }`.
- `completed: true` setea `completedAt = now()`. `completed: false` lo limpia.
- `sectionId` permite mover la task a otra sección — la nueva debe pertenecer al usuario.
  La task va al final del orden de la sección destino.
- **Response:** `200` — `TaskResponseDto`.
- `404 TSK_005` task no encontrada.
- `404 TSK_001` sección destino no encontrada o ajena.

### `DELETE /tasks/:id`

Hard-delete.

- **Response:** `204 No Content`.
- `404 TSK_005`.

### `PATCH /tasks/reorder`

Reordena tasks dentro de **una** sección. La drag-and-drop está restringida a la
misma sección.

- **Body:** `{ "sectionId": "uuid", "orderedIds": ["id1", "id2", ...] }`.
- **Response:** `204 No Content`.
- `404 TSK_001` sección no encontrada o ajena.
- `422 TSK_009` algún ID no existe, no pertenece al usuario, o no está en la sección.

---

## Alerts (Notificaciones in-app)

Pseudo-notificaciones que el frontend lee al abrir el bell del header. **No hay tabla de
alertas** — se recomputan al vuelo desde monthly-services, habits, budgets y chores en
cada `GET /alerts`. El backend filtra las que el usuario cerró (per-day), aplica el gate
de mediodía server-side, y devuelve también `lastSeenAt` para que el frontend calcule el
badge sin segundo roundtrip.

**Cinco triggers** con dos políticas de dismiss:

| Tipo                 | Policy     | Cuándo dispara                                                               |
| -------------------- | ---------- | ---------------------------------------------------------------------------- |
| `service-due-today`  | per-day    | Servicio mensual activo cuyo `nextDuePeriod === currentPeriod` y no está pagado, con la ventana abierta según tenga o no día aproximado (ver abajo) |
| `service-overdue`    | persistent | Servicio cuyo `nextDuePeriod < currentPeriod` (más viejo que este mes)       |
| `habits-midday`      | per-day    | ≥1 hábito DAILY activo sin log de hoy Y hora local ≥ 12:00                   |
| `budget-unlogged`    | per-day    | Budget del mes con `amount - spent > 0` y ≥2 días consecutivos sin movimientos (hasta hoy) Y hora local ≥ 12:00 — recordatorio "¿olvidaste registrar un gasto?" |
| `chore-overdue`      | persistent | Chore activo con `nextDueDate < today`                                       |
| `chore-due-today`    | per-day    | Chore activo con `nextDueDate == today` — "esto toca hoy". Sin gate horario: la alerta es in-app, así que solo se ve cuando el usuario abre la app |

#### Ventana de `service-due-today`

Cuándo se considera que el servicio "toca", según tenga ancla o no:

| `dueDay` | Ventana | Por qué |
| -------- | ------- | ------- |
| definido | desde el día `dueDay` en adelante (día de hoy `>= dueDay`, en la TZ del usuario) | `dueDay` es **aproximado** ("Día aproximado de vencimiento"). Compararlo con `===` le daba a la alerta un solo día de vida: no abrir la app ese día era perderla entera. Las boletas se pagan en o después de su fecha de referencia |
| `null`   | los últimos **3 días** del período | Sin ancla del usuario, el ancla es el borde del período: el servicio debe pagarse *dentro* de su período y al día siguiente ya es overdue por definición. Antes esto no emitía nada, así que un servicio sin fecha aproximada recién avisaba cuando ya estaba vencido |

En ambos casos la alerta vive hasta que se pague o el período pase a overdue, y `service-overdue` gana cuando corresponde (es el estado más específico).

El payload lleva `daysLeftInPeriod` **solo** en el caso sin ancla (`dueDay: null`); con `dueDay` definido viene en `null`, porque ahí el copy usa el día. El cálculo vive en el backend porque la zona horaria del usuario vive de este lado — el frontend nunca deriva "qué día es hoy".

- **Per-day**: el usuario puede cerrarlas y vuelven a aparecer al día siguiente (medianoche
  en su TZ). El backend registra el dismiss con `expiresAt = endOfDayInTimezone(tz, now)`.
- **Persistent**: NO se pueden cerrar manualmente — se van solas cuando la condición se
  resuelve (pagás el servicio, ajustás el budget, hacés el chore). `POST /:id/dismiss`
  sobre estas devuelve `409 ALR_001`.

> **Mediodía gate:** el alerta `habits-midday` se filtra server-side cuando la hora local
> del usuario es < 12. El frontend recibe la lista ya filtrada — no calcula horas.

> **`x-timezone`:** `GET /alerts` lee el header `x-timezone` (mismo patrón que budgets/reports)
> para resolver "hoy", "este mes" y la hora local del usuario. Si falta, se usa la TZ del
> `user_settings`; si tampoco hay, fallback a `'UTC'`.

Todos los endpoints requieren `Authorization: Bearer <accessToken>`.

### `GET /alerts`

Lista las alertas activas del usuario, ya filtradas por dismissals activos y por el gate
de mediodía.

- **Headers:** `x-timezone` (recomendado, IANA — ej. `America/Lima`).
- **Response:** `200` — `AlertsListResponseDto`:

```json
{
  "alerts": [
    {
      "id": "service-due-today:550e8400-e29b-41d4-a716-446655440000:2026-05",
      "type": "service-due-today",
      "severity": "info",
      "isDismissable": true,
      "triggeredAt": "2026-05-01T00:00:00.000Z",
      "payload": {
        "serviceId": "550e8400-...",
        "serviceName": "Netflix",
        "dueDay": 15,
        "daysLeftInPeriod": null,
        "currency": "PEN",
        "estimatedAmount": 45.9
      }
    }
  ],
  "lastSeenAt": "2026-05-18T22:30:00.000Z"
}
```

- `id`: string estable. Los per-day embeben el período/fecha (`service-due-today:{uuid}:YYYY-MM`,
  `habits-midday:YYYY-MM-DD`, `budget-unlogged:{uuid}:YYYY-MM-DD`, `chore-due-today:{uuid}:YYYY-MM-DD`)
  para que la dismiss caduque a la próxima ventana. Los persistent omiten el período
  (`service-overdue:{uuid}`, `chore-overdue:{uuid}`) porque la identidad de la alerta no depende del
  tiempo — se va al resolverse.
- `type`: ver enum [`AlertType`](enums.md#alerttype).
- `severity`: ver enum [`AlertSeverity`](enums.md#alertseverity).
- `isDismissable`: refleja la policy. `true` para per-day, `false` para persistent. El
  frontend lo usa para mostrar/ocultar el botón "Cerrar".
- `triggeredAt`: UTC ISO. Para `service-due-today`/`service-overdue`/`chore-overdue` = inicio
  del período/día que disparó. Para `habits-midday` y `budget-unlogged`: `now`. El frontend lo
  compara contra `lastSeenAt` para contar "nuevas".
- `payload`: bag de keys según `type`. Shape por tipo:
  - `service-due-today`: `serviceId, serviceName, dueDay, currency, estimatedAmount`.
  - `service-overdue`: `serviceId, serviceName, overduePeriod, currency, estimatedAmount`.
  - `habits-midday`: `missingCount, firstHabitName`.
  - `budget-unlogged`: `budgetId, currency, remaining` (`> 0`), `days` (racha de días sin registrar, ≥2).
  - `chore-overdue`: `choreId, choreName, nextDueDate` (`YYYY-MM-DD`).
  - `chore-due-today`: `choreId, choreName, nextDueDate` (`YYYY-MM-DD`, == hoy). Misma shape que `chore-overdue`.
- `lastSeenAt`: timestamp del último `POST /alerts/mark-seen`. `null` si el usuario nunca
  abrió el popover. El badge del bell = `alerts.filter(a => a.triggeredAt > lastSeenAt).length`.

### `POST /alerts/:alertId/dismiss`

Cierra una alerta hasta medianoche en la TZ del usuario. Solo válido para per-day.

- **Response:** `204 No Content` cuando el dismiss queda registrado.
- `409 ALR_001` si la alerta es persistent (no se puede cerrar manualmente) o si el
  prefijo de `alertId` no se reconoce (defensa contra inputs malformados).

> **Idempotente:** llamar dos veces seguidas con el mismo `alertId` upsertea sobre el
> UNIQUE `(userId, alertId)` — no rompe, refresca `expiresAt`. La UI no necesita
> deduplicar.

### `POST /alerts/mark-seen`

Bumpea `user_settings.lastAlertsSeenAt` al timestamp actual del servidor. El frontend lo
llama cuando el usuario abre el popover del bell.

- **Response:** `204 No Content`.
- **Importante:** este endpoint **NO** toca `user_settings.updatedAt`. La queryKey de
  `useUserSettings` no se invalida automáticamente, así que la UI sigue cacheada y NO
  refetcha el doc completo. Solo la próxima `GET /alerts` trae el nuevo `lastSeenAt`.

