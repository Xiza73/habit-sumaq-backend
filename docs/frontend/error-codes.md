# Códigos de Error — Frontend

Cuando una operación falla, la respuesta incluye un `error.code` (hash de 8 caracteres). Usa este código para mostrar mensajes contextuales en la UI.

## Formato de error

```json
{
  "success": false,
  "data": null,
  "message": "Descripción legible del error",
  "error": {
    "code": "a3f1c209",
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

| Código clave | HTTP | Descripción | Cuándo ocurre |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | 404 | Cuenta no encontrada | GET/PATCH/DELETE con UUID inexistente |
| `ACCOUNT_NAME_TAKEN` | 409 | Nombre de cuenta ya en uso | POST/PATCH con nombre duplicado |
| `ACCOUNT_HAS_ACTIVE_TRANSACTIONS` | 409 | La cuenta tiene transacciones activas | DELETE de cuenta con transacciones |
| `ACCOUNT_BELONGS_TO_OTHER_USER` | 403 | La cuenta pertenece a otro usuario | Acceso a cuenta ajena |
| `CANNOT_CHANGE_CURRENCY_WITH_TX` | 409 | No se puede cambiar la moneda | Cambio de moneda con transacciones existentes |

### Categorías

| Código clave | HTTP | Descripción | Cuándo ocurre |
|---|---|---|---|
| `CATEGORY_NOT_FOUND` | 404 | Categoría no encontrada | GET/PATCH/DELETE con UUID inexistente |
| `CATEGORY_NAME_TAKEN` | 409 | Nombre ya en uso para este tipo | POST/PATCH con nombre duplicado por tipo |
| `CATEGORY_BELONGS_TO_OTHER_USER` | 403 | La categoría pertenece a otro usuario | Acceso a categoría ajena |
| `CANNOT_DELETE_DEFAULT_CATEGORY` | 409 | No se puede eliminar categoría por defecto | DELETE de categoría con `isDefault=true` |

### Transacciones

| Código clave | HTTP | Descripción | Cuándo ocurre |
|---|---|---|---|
| `TRANSACTION_NOT_FOUND` | 404 | Transacción no encontrada | GET/PATCH/DELETE con UUID inexistente |
| `TRANSACTION_BELONGS_TO_OTHER_USER` | 403 | La transacción pertenece a otro usuario | Acceso a transacción ajena |
| `INSUFFICIENT_BALANCE` | 422 | Balance insuficiente | EXPENSE/TRANSFER excede el balance |
| `TRANSFER_SAME_ACCOUNT` | 422 | No se puede transferir a la misma cuenta | TRANSFER con `accountId === destinationAccountId` |
| `TRANSFER_CURRENCY_MISMATCH` | 422 | Las cuentas tienen monedas distintas | TRANSFER entre cuentas con diferente currency |
| `DESTINATION_ACCOUNT_NOT_FOUND` | 404 | Cuenta destino no encontrada | TRANSFER con `destinationAccountId` inválido |
| `TRANSFER_DESTINATION_REQUIRED` | 422 | Falta cuenta destino | TRANSFER sin `destinationAccountId` |

### Deudas y préstamos

| Código clave | HTTP | Descripción | Cuándo ocurre |
|---|---|---|---|
| `REFERENCE_REQUIRED` | 422 | DEBT/LOAN requiere campo `reference` | Crear DEBT/LOAN sin `reference` |
| `TRANSACTION_NOT_DEBT_OR_LOAN` | 422 | Solo se pueden liquidar DEBT/LOAN | POST settle en INCOME/EXPENSE/TRANSFER |
| `TRANSACTION_ALREADY_SETTLED` | 409 | Ya fue liquidada completamente | POST settle en transacción con `status=SETTLED` |
| `CANNOT_UPDATE_SETTLED_TRANSACTION` | 409 | No se puede modificar una tx liquidada | PATCH en DEBT/LOAN con `status=SETTLED` |
| `SETTLEMENT_AMOUNT_EXCEEDS_REMAINING` | 422 | El monto excede el saldo pendiente | POST settle con `amount > remainingAmount` |

### Generales

| Código clave | HTTP | Descripción | Cuándo ocurre |
|---|---|---|---|
| `INVALID_MONEY_AMOUNT` | 422 | Monto inválido | Monto negativo o con formato incorrecto |
| `CURRENCY_MISMATCH` | 422 | Incompatibilidad de monedas | Operaciones entre monedas distintas |
| `VALIDATION_ERROR` | 400 | Error de validación de campos | Campos faltantes, formato incorrecto, etc. |
| `USER_NOT_FOUND` | 404 | Usuario no encontrado | Token válido pero usuario eliminado |
| `USER_INACTIVE` | 403 | Usuario desactivado | Token válido pero usuario inactivo |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token inválido o expirado | POST /auth/refresh con token malo |

---

## Cómo usar los códigos en el frontend

> **Importante:** Los códigos en la tabla de arriba son los **nombres internos** (claves). El valor real enviado en `error.code` es un hash SHA-256 de 8 caracteres. Para hacer match, genera los hashes al inicio de tu app o usa una tabla de lookup.

### Ejemplo de lookup table (TypeScript)

```typescript
import { createHash } from 'crypto';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex').slice(0, 8);
}

export const ERROR_CODES = {
  ACCOUNT_NOT_FOUND: hashCode('ACCOUNT_NOT_FOUND'),
  ACCOUNT_NAME_TAKEN: hashCode('ACCOUNT_NAME_TAKEN'),
  TRANSACTION_ALREADY_SETTLED: hashCode('TRANSACTION_ALREADY_SETTLED'),
  // ... agregar los que necesites
} as const;

// Uso:
if (response.error?.code === ERROR_CODES.ACCOUNT_NAME_TAKEN) {
  showToast('Ya tienes una cuenta con ese nombre');
}
```

### Ejemplo con mapa inverso

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  [hashCode('ACCOUNT_NAME_TAKEN')]: 'Ya tienes una cuenta con ese nombre',
  [hashCode('INSUFFICIENT_BALANCE')]: 'No tienes saldo suficiente',
  [hashCode('TRANSACTION_ALREADY_SETTLED')]: 'Esta deuda ya fue liquidada',
  // ...
};

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Ocurrió un error inesperado';
}
```

---

## Errores de validación (`VALIDATION_ERROR`)

Los errores de validación incluyen `details` con información por campo:

```json
{
  "success": false,
  "data": null,
  "message": "Error de validación",
  "error": {
    "code": "hash-del-validation-error",
    "details": [
      { "field": "amount", "message": "amount must be a positive number" },
      { "field": "accountId", "message": "accountId must be a UUID" }
    ]
  }
}
```

Usa `details` para mostrar errores inline en los campos del formulario.
