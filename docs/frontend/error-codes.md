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

| Código    | HTTP | Descripción                            | Cuándo ocurre                                   |
| --------- | ---- | -------------------------------------- | ----------------------------------------------- |
| `TXN_008` | 422  | DEBT/LOAN requiere campo `reference`   | Crear DEBT/LOAN sin `reference`                 |
| `TXN_009` | 422  | Solo se pueden liquidar DEBT/LOAN      | POST settle en INCOME/EXPENSE/TRANSFER          |
| `TXN_010` | 409  | Ya fue liquidada completamente         | POST settle en transacción con `status=SETTLED` |
| `TXN_011` | 409  | No se puede modificar una tx liquidada | PATCH en DEBT/LOAN con `status=SETTLED`         |
| `TXN_012` | 422  | El monto excede el saldo pendiente     | POST settle con `amount > remainingAmount`      |
| `TXN_013` | 422  | Monto menor que lo ya liquidado        | PATCH amount en DEBT/LOAN por debajo de pagos   |

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
