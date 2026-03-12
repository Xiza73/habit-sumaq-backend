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

| Campo | Tipo | Notas |
|---|---|---|
| `language` | Language | Ver [enums.md](enums.md#language) |
| `theme` | Theme | Ver [enums.md](enums.md#theme) |
| `defaultCurrency` | Currency | Ver [enums.md](enums.md#currency) |
| `dateFormat` | DateFormat | Ver [enums.md](enums.md#dateformat) |
| `startOfWeek` | StartOfWeek | Ver [enums.md](enums.md#startofweek) |

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
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Accounts

### `POST /accounts`

Crea una nueva cuenta.

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `name` | string | sí | Máx 100 chars. Único por usuario |
| `type` | AccountType | sí | Ver [enums.md](enums.md#accounttype) |
| `currency` | Currency | sí | Ver [enums.md](enums.md#currency) |
| `initialBalance` | number | no | Default `0`. Mín `0` |
| `color` | string \| null | no | Máx 7 chars (hex: `#FF5733`) |
| `icon` | string \| null | no | Máx 50 chars |

**Response:** `201` — `AccountResponseDto`

**Errores:**
- `409` — Ya existe una cuenta con ese nombre

### `GET /accounts`

Lista las cuentas del usuario.

| Query param | Tipo | Descripción |
|---|---|---|
| `includeArchived` | boolean | Si `true`, incluye cuentas archivadas |

**Response:** `200` — `AccountResponseDto[]`

### `GET /accounts/:id`

Obtiene una cuenta por UUID.

**Errores:**
- `403` — La cuenta pertenece a otro usuario
- `404` — Cuenta no encontrada

### `PATCH /accounts/:id`

Actualiza nombre, color e ícono.

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | Máx 100 chars |
| `color` | string \| null | Máx 7 chars |
| `icon` | string \| null | Máx 50 chars |

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
  "balance": 1500.50,
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

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `name` | string | sí | Máx 100 chars. Único por usuario + tipo |
| `type` | CategoryType | sí | `INCOME` o `EXPENSE`. No editable después |
| `color` | string \| null | no | Máx 7 chars |
| `icon` | string \| null | no | Máx 50 chars |

**Response:** `201` — `CategoryResponseDto`

**Errores:**
- `409` — Ya existe una categoría con ese nombre y tipo

### `GET /categories`

Lista categorías del usuario (incluye las por defecto).

| Query param | Tipo | Descripción |
|---|---|---|
| `type` | CategoryType | Filtrar por `INCOME` o `EXPENSE` |

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

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `accountId` | UUID | sí | Cuenta origen |
| `categoryId` | UUID \| null | no | Categoría asociada |
| `type` | TransactionType | sí | Ver [enums.md](enums.md#transactiontype) |
| `amount` | number | sí | Mín `0.01`, máx 2 decimales |
| `description` | string \| null | no | Máx 255 chars |
| `date` | ISO 8601 | sí | Fecha de la transacción |
| `destinationAccountId` | UUID \| null | condicional | **Requerido** para TRANSFER |
| `reference` | string \| null | condicional | **Requerido** para DEBT/LOAN. Máx 255 chars |

**Comportamiento por tipo:**

| Tipo | Efecto en balance | Campos especiales |
|---|---|---|
| INCOME | `+amount` en `accountId` | — |
| EXPENSE | `−amount` en `accountId` | — |
| TRANSFER | `−amount` en origen, `+amount` en destino | `destinationAccountId` requerido |
| DEBT | Sin efecto | `reference` requerido. Crea con `status=PENDING` |
| LOAN | Sin efecto | `reference` requerido. Crea con `status=PENDING` |

**Response:** `201` — `TransactionResponseDto`

**Errores:**
- `404` — Cuenta origen o destino no encontrada
- `422` — Monedas distintas (TRANSFER), misma cuenta (TRANSFER), falta reference (DEBT/LOAN)

### `POST /transactions/:id/settle`

Liquida parcial o totalmente una deuda/préstamo.

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `accountId` | UUID | sí | Cuenta de pago (DEBT) o cobro (LOAN) |
| `amount` | number | sí | Mín `0.01`, máx 2 decimales. Debe ser ≤ `remainingAmount` |
| `description` | string \| null | no | Si se omite se genera automáticamente |
| `date` | ISO 8601 | no | Si se omite usa fecha actual |

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

### `GET /transactions`

Lista transacciones del usuario, ordenadas por fecha descendente.

| Query param | Tipo | Descripción |
|---|---|---|
| `accountId` | UUID | Filtrar por cuenta |
| `categoryId` | UUID | Filtrar por categoría |
| `type` | TransactionType | Filtrar por tipo |
| `status` | TransactionStatus | Filtrar por estado (solo aplica a DEBT/LOAN) |
| `dateFrom` | ISO 8601 | Fecha mínima (inclusiva) |
| `dateTo` | ISO 8601 | Fecha máxima (inclusiva) |

**Response:** `200` — `TransactionResponseDto[]`

### `GET /transactions/:id`

Obtiene una transacción por UUID.

**Errores:**
- `403` — Pertenece a otro usuario
- `404` — No encontrada

### `PATCH /transactions/:id`

Actualiza campos editables. El `type` **no es editable**.

| Campo | Tipo | Notas |
|---|---|---|
| `categoryId` | UUID \| null | — |
| `amount` | number | Mín `0.01`. Recalcula balance automáticamente |
| `description` | string \| null | Máx 255 chars |
| `date` | ISO 8601 | — |
| `reference` | string \| null | Máx 255 chars |

> **Restricción:** Las transacciones DEBT/LOAN con `status=SETTLED` **no se pueden modificar**.

**Errores:**
- `404` — No encontrada
- `409` — No se puede modificar una transacción liquidada (SETTLED)

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
  "amount": 50.00,
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
  "amount": 100.00,
  "reference": "Juan Pérez",
  "status": "PENDING",
  "remainingAmount": 60.00,
  "relatedTransactionId": null
}
```

**Ejemplo liquidación:**

```json
{
  "id": "uuid-settlement",
  "type": "EXPENSE",
  "amount": 40.00,
  "reference": "Juan Pérez",
  "status": null,
  "remainingAmount": null,
  "relatedTransactionId": "uuid-debt"
}
```
