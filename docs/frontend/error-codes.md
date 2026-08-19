# Códigos de Error — Frontend

Cuando una operación falla, la respuesta incluye un `error.code` con un identificador opaco. Usa este código para mostrar mensajes contextuales en la UI.

## Formato de error

```json
{
  "success": false,
  "data": null,
  "message": "Descripción legible del error",
  "error": {
    "code": "ACC_001",
    "details": [...]
  }
}
```

- **`message`**: Texto legible en español, útil para mostrar al usuario como fallback.
- **`error.code`**: Identificador estable del tipo de error. Usar este valor para lógica condicional en el frontend.
- **`error.details`**: Solo presente en errores de validación. Array de `{ field, message }`.

---

## Tabla de códigos

### Cuentas

| Código    | HTTP | Descripción                           | Cuándo ocurre                                 |
| --------- | ---- | ------------------------------------- | --------------------------------------------- |
| `ACC_001` | 404  | Cuenta no encontrada                  | GET/PATCH/DELETE con UUID inexistente         |
| `ACC_002` | 409  | Nombre de cuenta ya en uso            | POST/PATCH con nombre duplicado               |
| `ACC_003` | 409  | La cuenta tiene transacciones activas | DELETE de cuenta con transacciones            |
| `ACC_004` | 403  | La cuenta pertenece a otro usuario    | Acceso a cuenta ajena                         |
| `ACC_005` | 409  | No se puede cambiar la moneda         | Cambio de moneda con transacciones existentes |

### Categorías

| Código    | HTTP | Descripción                                | Cuándo ocurre                            |
| --------- | ---- | ------------------------------------------ | ---------------------------------------- |
| `CAT_001` | 404  | Categoría no encontrada                    | GET/PATCH/DELETE con UUID inexistente    |
| `CAT_002` | 409  | Nombre ya en uso para este tipo            | POST/PATCH con nombre duplicado por tipo |
| `CAT_003` | 403  | La categoría pertenece a otro usuario      | Acceso a categoría ajena                 |
| `CAT_004` | 409  | No se puede eliminar categoría por defecto | DELETE de categoría con `isDefault=true` |

### Transacciones

| Código    | HTTP | Descripción                              | Cuándo ocurre                                     |
| --------- | ---- | ---------------------------------------- | ------------------------------------------------- |
| `TXN_001` | 404  | Transacción no encontrada                | GET/PATCH/DELETE con UUID inexistente             |
| `TXN_002` | 403  | La transacción pertenece a otro usuario  | Acceso a transacción ajena                        |
| `TXN_003` | 422  | Balance insuficiente                     | EXPENSE/TRANSFER excede el balance                |
| `TXN_004` | 422  | No se puede transferir a la misma cuenta | TRANSFER con `accountId === destinationAccountId` |
| `TXN_005` | 422  | Las cuentas tienen monedas distintas     | TRANSFER entre cuentas con diferente currency     |
| `TXN_006` | 404  | Cuenta destino no encontrada             | TRANSFER con `destinationAccountId` inválido      |
| `TXN_007` | 422  | Falta cuenta destino                     | TRANSFER sin `destinationAccountId`               |

### Deudas y préstamos

> **v1.0.0 refactor (in progress — phase A3-B):** los códigos `TXN_008`–`TXN_013`
> permanecen activos contra el módulo legacy `transactions` y se retiran cuando
> Phase A6 elimine ese módulo. El nuevo módulo `debts_loans` usa códigos `DBT_*`
> con la misma semántica.

| Código    | HTTP | Descripción                            | Cuándo ocurre                                   |
| --------- | ---- | -------------------------------------- | ----------------------------------------------- |
| `TXN_008` | 422  | DEBT/LOAN requiere campo `reference`   | Crear DEBT/LOAN sin `reference` (legacy)        |
| `TXN_009` | 422  | Solo se pueden liquidar DEBT/LOAN      | POST settle en INCOME/EXPENSE/TRANSFER (legacy) |
| `TXN_010` | 409  | Ya fue liquidada completamente         | POST settle en transacción con `status=SETTLED` (legacy) |
| `TXN_011` | 409  | No se puede modificar una tx liquidada | PATCH en DEBT/LOAN con `status=SETTLED` (legacy) |
| `TXN_012` | 422  | El monto excede el saldo pendiente     | POST settle con `amount > remainingAmount` (legacy) |
| `TXN_013` | 422  | Monto menor que lo ya liquidado        | PATCH amount en DEBT/LOAN por debajo de pagos (legacy) |
| `DBT_001` | 404  | Debt/Loan no encontrado                | GET/PATCH/DELETE/settle con UUID inexistente    |
| `DBT_002` | 403  | El debt/loan pertenece a otro usuario  | Acceso a un id de otro user                     |
| `DBT_003` | 422  | DEBT/LOAN requiere campo `reference`   | Crear sin `reference`                           |
| `DBT_004` | 409  | Ya fue liquidado completamente         | POST settle sobre un row con `status=SETTLED`   |
| `DBT_005` | 409  | No se puede modificar un debt/loan liquidado | PATCH con campos distintos a `amount` en `status=SETTLED` |
| `DBT_006` | 422  | El monto de liquidación excede el pendiente | POST settle con `settledAmount > remainingAmount`, o PATCH payment con `amount` que dejaría `remainingAmount < 0` |
| `DBT_007` | 422  | El nuevo monto es menor a lo ya liquidado | PATCH amount por debajo de `(amount - remainingAmount)` |
| `DBT_008` | 404  | Payment no encontrado                  | PATCH/DELETE `/debts/payments/:id` con UUID inexistente |
| `DBT_009` | 422  | Update de payment sin campos a modificar | PATCH `/debts/payments/:id` sin `amount` ni `note` |
| `DBT_010` | 422  | El saldo recomputado excedería el monto del debt/loan | PATCH/DELETE payment que dejaría `remainingAmount > debt.amount` |
| `DBT_011` | 404  | No hay obligaciones pendientes para el grupo `(reference, currency, type)` | POST `/debts/settle-amount-by-reference` sin rows PENDING que matcheen |

### Budget Movements (v1.0.0)

> Introducidos en Phase A4-B del refactor `accounts-to-modular-finance`. Coexisten con
> los EXPENSE legacy en `/transactions` (con `budgetId IS NOT NULL`) hasta Phase A6.

| Código    | HTTP | Descripción                                | Cuándo ocurre                                  |
| --------- | ---- | ------------------------------------------ | ---------------------------------------------- |
| `BMV_001` | 404  | Movimiento no encontrado                   | GET/PATCH/DELETE con UUID inexistente         |
| `BMV_002` | 403  | El movimiento pertenece a otro usuario     | Acceso a un id de otro user                    |
| `BMV_003` | 422  | Fecha fuera del rango del budget           | `date` no cae dentro del `(year, month)` del budget |
| `BMV_004` | 422  | Currency del movimiento ≠ currency del budget | POST/PATCH con currency distinta a la del budget |

### Monthly Service Payments (v1.0.0)

> Introducidos en Phase A4-B del refactor `accounts-to-modular-finance`. Coexisten con
> los EXPENSE legacy en `/transactions` (con `monthlyServiceId IS NOT NULL`) hasta Phase A6.

| Código    | HTTP | Descripción                                        | Cuándo ocurre                                       |
| --------- | ---- | -------------------------------------------------- | --------------------------------------------------- |
| `MSP_001` | 404  | Pago no encontrado                                 | GET/PATCH/DELETE con UUID inexistente              |
| `MSP_002` | 403  | El pago pertenece a otro usuario                   | Acceso a un id de otro user                         |
| `MSP_003` | 409  | Ya existe un pago para esa `(service, period)`     | POST sobre un par que ya tiene una row activa       |
| `MSP_004` | 422  | Currency del pago ≠ currency del servicio          | POST con currency distinta a la del monthly service |
| `MSP_005` | 422  | Formato de período inválido (esperado `YYYY-MM`)   | POST con period malformado                          |
| `MSP_010` | 422  | La suma de `participants[].amount` supera el `amount` total del pago | POST con splits cuya suma excede el total pagado |

### Hábitos

| Código    | HTTP | Descripción                        | Cuándo ocurre                            |
| --------- | ---- | ---------------------------------- | ---------------------------------------- |
| `HAB_001` | 404  | Hábito no encontrado               | GET/PATCH/DELETE con UUID inexistente    |
| `HAB_002` | 409  | Nombre de hábito ya en uso         | POST/PATCH con nombre duplicado          |
| `HAB_003` | 422  | Hábito archivado                   | POST log en hábito con `isArchived=true` |
| `HAB_004` | 422  | Fecha futura                       | POST log con fecha posterior a hoy       |
| `HAB_005` | 422  | targetCount inválido               | targetCount < 1                          |
| `HAB_006` | 403  | El hábito pertenece a otro usuario | Acceso a hábito ajeno                    |

### Quick Tasks (Diarias)

| Código    | HTTP | Descripción                                   | Cuándo ocurre                                                |
| --------- | ---- | --------------------------------------------- | ------------------------------------------------------------ |
| `QTK_001` | 404  | Tarea no encontrada                           | PATCH/DELETE con UUID inexistente                            |
| `QTK_002` | 403  | La tarea pertenece a otro usuario             | Acceso a tarea ajena                                         |
| `QTK_003` | 422  | Título obligatorio                            | POST/PATCH con `title` vacío o solo whitespace               |
| `QTK_004` | 422  | Título supera 120 chars                       | POST/PATCH con título demasiado largo                        |
| `QTK_005` | 422  | Descripción supera 5000 chars                 | POST/PATCH con descripción demasiado larga                   |
| `QTK_006` | 422  | Reorder incluye ids no propias del usuario    | PATCH /quick-tasks/reorder con uuid de otro user o inexistente |

### Reminders (Recordatorios)

| Código     | HTTP | Descripción                          | Cuándo ocurre                                                       |
| ---------- | ---- | ------------------------------------ | ------------------------------------------------------------------- |
| `RMDR_001` | 404  | Recordatorio no encontrado           | PATCH/DELETE con UUID inexistente                                   |
| `RMDR_002` | 403  | Pertenece a otro usuario             | Acceso a recordatorio ajeno                                         |
| `RMDR_003` | 422  | Título obligatorio                   | POST/PATCH con `title` vacío o solo whitespace                      |
| `RMDR_004` | 422  | Título supera 120 chars              | POST/PATCH con título demasiado largo                               |
| `RMDR_005` | 422  | Notas superan 5000 chars             | POST/PATCH con notas demasiado largas                               |
| `RMDR_006` | 422  | Fecha con formato inválido           | `remindDate` que no es `YYYY-MM-DD`                                 |
| `RMDR_007` | 422  | Hora con formato inválido            | `remindTime` que no es `HH:mm` 24h                                  |
| `RMDR_008` | 422  | Hora sin fecha                       | `remindTime` seteada con `remindDate` en null — no es un estado válido |

### Monthly Services

| Código     | HTTP | Descripción                                 | Cuándo ocurre                                                                                        |
| ---------- | ---- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `MSVC_001` | 409  | El servicio tiene pagos registrados         | DELETE /monthly-services/:id cuando existen transacciones vinculadas. Archivalo en su lugar.         |
| `MSVC_002` | 404  | Servicio mensual no encontrado              | GET/PATCH/POST .../pay .../skip DELETE con UUID inexistente o perteneciente a otro usuario.          |
| `MSVC_003` | 409  | Ya tenés un servicio activo con ese nombre  | POST/PATCH con un nombre duplicado entre tus servicios activos.                                      |
| `MSVC_004` | 409  | El servicio ya está pagado para el mes actual | POST /monthly-services/:id/pay cuando el servicio ya está al día (idempotency guard).              |

### Participantes de servicios compartidos

Modelo batch replace (`PUT /monthly-services/:id/participants`, y opcionalmente `participants[]`
en `POST /monthly-services`) — no hay endpoints de agregar/editar/quitar uno por uno.

| Código                              | HTTP | Descripción                                              | Cuándo ocurre                                                                                     |
| ------------------------------------ | ---- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `MSP_PARTICIPANT_NOT_FOUND`          | 404  | Participante no encontrado                                | Reservado — no se lanza actualmente (no hay endpoint que busque un participante individual por id). |
| `MSP_PARTICIPANT_DUPLICATE_REFERENCE`| 409  | Ya existe un participante con esa referencia               | `PUT .../participants` o `participants[]` en `POST /monthly-services` con dos referencias que normalizan igual DENTRO del mismo envío (o una carrera de unicidad contra la base de datos). |
| `MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED` | 422 | La suma de montos supera el estimado del servicio        | `sum(participants[].defaultAmount)` del envío supera `estimatedAmount` del servicio.               |
| `MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE`| 422  | El monto por defecto debe ser mayor a 0                    | Algún `participants[].defaultAmount` ≤ 0 (defensa adicional — `class-validator` ya rechaza esto con 400 antes de llegar al use case). |

### Chores (Tareas recurrentes no diarias)

| Código     | HTTP | Descripción                                  | Cuándo ocurre                                                                                |
| ---------- | ---- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `CHRE_001` | 409  | La tarea tiene eventos (logs) registrados    | DELETE /chores/:id cuando ya existen logs. Archivala en su lugar con PATCH /:id/archive.     |
| `CHRE_002` | 404  | Tarea no encontrada                          | GET/PATCH/POST .../done .../skip DELETE con UUID inexistente o perteneciente a otro usuario. |
| `CHRE_003` | 409  | La tarea no tiene eventos para revertir      | POST /chores/:id/revert-last-done cuando la chore no tiene ningún log (no borrado) que deshacer. |

### Budgets (Presupuestos mensuales)

| Código     | HTTP | Descripción                              | Cuándo ocurre                                                                                                  |
| ---------- | ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `BDGT_001` | 404  | Budget no encontrado                     | GET/PATCH/DELETE /budgets/:id o POST /budgets/:id/movements con UUID inexistente o perteneciente a otro usuario. |
| `BDGT_002` | 409  | Ya existe un budget para ese período     | POST /budgets cuando ya hay un budget activo para esa combinación (year, month, currency).                     |
| `BDGT_003` | 422  | Fecha del movimiento fuera del mes       | POST /budgets/:id/movements con `date` fuera del mes calendario del budget.                                    |

### Alerts (Notificaciones in-app)

| Código    | HTTP | Descripción                              | Cuándo ocurre                                                                                          |
| --------- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ALR_001` | 409  | Esta alerta no se puede descartar        | POST /alerts/:alertId/dismiss sobre una alerta persistente (service-overdue, chore-overdue) o un alertId con prefijo no reconocido. |

### Tasks + Sections (TODOs estilo proyectos con cleanup semanal)

| Código    | HTTP | Descripción                                       | Cuándo ocurre                                                                          |
| --------- | ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `TSK_001` | 404  | Sección no encontrada                             | GET/PATCH/DELETE /tasks/sections/:id, POST /tasks (con sección ajena), o move cross-section a sección ajena. |
| `TSK_002` | 422  | Nombre de sección requerido                       | POST/PATCH /tasks/sections con `name` vacío o whitespace.                              |
| `TSK_003` | 422  | Nombre de sección demasiado largo                 | POST/PATCH /tasks/sections con `name` > 60 caracteres.                                 |
| `TSK_004` | 422  | Reordenamiento de secciones con IDs inválidas     | PATCH /tasks/sections/reorder con algún ID que no existe o no pertenece al usuario.    |
| `TSK_005` | 404  | Task no encontrada                                | GET/PATCH/DELETE /tasks/:id con UUID inexistente o perteneciente a otro usuario.       |
| `TSK_006` | 422  | Título de task requerido                          | POST/PATCH /tasks con `title` vacío o whitespace.                                      |
| `TSK_007` | 422  | Título de task demasiado largo                    | POST/PATCH /tasks con `title` > 120 caracteres.                                        |
| `TSK_008` | 422  | Descripción de task demasiado larga               | POST/PATCH /tasks con `description` > 5000 caracteres.                                 |
| `TSK_009` | 422  | Reordenamiento de tasks con IDs inválidas         | PATCH /tasks/reorder con IDs que no existen, no pertenecen al usuario, o no están en la sección. |

### Generales

| Código    | HTTP | Descripción                       | Cuándo ocurre                              |
| --------- | ---- | --------------------------------- | ------------------------------------------ |
| `VAL_001` | 422  | Monto inválido                    | Monto negativo o con formato incorrecto    |
| `VAL_002` | 422  | Incompatibilidad de monedas       | Operaciones entre monedas distintas        |
| `GEN_001` | 400  | Error de validación de campos     | Campos faltantes, formato incorrecto, etc. |
| `USR_001` | 404  | Usuario no encontrado             | Token válido pero usuario eliminado        |
| `USR_002` | 403  | Usuario desactivado               | Token válido pero usuario inactivo         |
| `AUT_001` | 401  | Refresh token inválido o expirado | POST /auth/refresh con token malo          |

---

## Cómo usar los códigos en el frontend

Los códigos se envían directamente en `error.code`. No requieren transformación.

### Ejemplo de constantes (TypeScript)

```typescript
export const ERROR_CODES = {
  ACCOUNT_NOT_FOUND: 'ACC_001',
  ACCOUNT_NAME_TAKEN: 'ACC_002',
  INSUFFICIENT_BALANCE: 'TXN_003',
  TRANSACTION_ALREADY_SETTLED: 'TXN_010',
  // ... agregar los que necesites
} as const;

// Uso:
if (response.error?.code === ERROR_CODES.ACCOUNT_NAME_TAKEN) {
  showToast('Ya tienes una cuenta con ese nombre');
}
```

### Ejemplo con mapa de mensajes

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  ACC_002: 'Ya tienes una cuenta con ese nombre',
  TXN_003: 'No tienes saldo suficiente',
  TXN_010: 'Esta deuda ya fue liquidada',
  // ...
};

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Ocurrió un error inesperado';
}
```

---

## Errores de validación (`GEN_001`)

Los errores de validación incluyen `details` con información por campo:

```json
{
  "success": false,
  "data": null,
  "message": "Los datos enviados son inválidos",
  "error": {
    "code": "GEN_001",
    "details": [
      { "field": "amount", "message": "amount must be a positive number" },
      { "field": "accountId", "message": "accountId must be a UUID" }
    ]
  }
}
```

Usa `details` para mostrar errores inline en los campos del formulario.
