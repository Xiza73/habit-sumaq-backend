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
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

> **Timezone default:** Usuarios pre-existentes tienen `'UTC'` hasta que el frontend auto-detecte su zona en el primer login post-deploy y haga un PATCH silencioso. Una vez seteado, el backend lo usa para cálculos "por día" como el cleanup diario de quick-tasks y el rango calendario-alineado (`month`, `3m`) en reports.

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

| Campo  | Tipo           | Requerido | Notas                             |
| ------ | -------------- | --------- | --------------------------------- |
| `date` | string         | sí        | Formato `YYYY-MM-DD`. No futura  |
| `count`| number         | sí        | Mín `0`. Cantidad realizada       |
| `note` | string \| null | no        | Máx 500 chars                     |

`completed` se calcula automáticamente: `count >= habit.targetCount`.

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
  "periodCompleted": false
}
```

> **Nota:** `currentStreak`, `longestStreak`, `completionRate`, `todayLog`, `periodCount` y `periodCompleted` solo están presentes en los endpoints que devuelven stats (`GET /habits`, `GET /habits/daily`, `GET /habits/:id`). En `POST` y `PATCH` no se incluyen.
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
se manejan como `YYYY-MM`. `nextDuePeriod`, `isOverdue` e `isPaidForCurrentMonth` son campos
calculados en cada respuesta, relativos al mes actual en la timezone del header `x-timezone`.

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
    "createdAt": "2026-01-05T12:00:00.000Z",
    "updatedAt": "2026-04-01T20:10:00.000Z"
  }
]
```

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
  "startPeriod": "2026-04"
}
```

`frequencyMonths` defaults to `1` (monthly). Allowed values: `1, 3, 6, 12` (mensual, trimestral, semestral, anual). **Inmutable** — no se puede cambiar después de crear el servicio.

- **Response:** `201` — `MonthlyServiceResponseDto`
- `404 ACC_001` si la cuenta no existe o no es tuya.
- `404 CAT_001` si la categoría no existe o no es tuya.
- `409 MSVC_003` si ya tenés un servicio activo con ese nombre.
- `422 VAL_002` si la moneda del DTO no coincide con la cuenta.

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
4. Recalcula `estimatedAmount` como promedio de las últimas 3 transacciones del servicio.

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
- `currentDate` = `YYYY-MM-DD` en la timezone del cliente.

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

### `POST /tasks/sections`

- **Body:** `{ "name": "Trabajo", "color": "#FF6B35" }` (`color` opcional, debe ser `#RRGGBB`).
- **Response:** `201` — `SectionResponseDto`. La sección se agrega al final del orden.

### `PATCH /tasks/sections/:id`

- **Body:** `{ "name"?, "color"? }` (`color: null` lo limpia).
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

