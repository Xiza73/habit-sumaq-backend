# Modelo de Dominio — Habit Sumaq v2

## Entidades principales

### User

El usuario es el agregado raíz. Todo dato en el sistema pertenece a un usuario.

```typescript
User {
  id: UUID
  googleId: string          // ID de Google OAuth
  email: string             // Único, inmutable
  name: string
  avatarUrl: string | null
  isActive: boolean         // Para suspensión de cuenta
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null    // Soft delete
}
```

**Reglas de negocio:**
- El email es único en el sistema.
- Un usuario desactivado (`isActive: false`) no puede autenticarse.
- El `googleId` es único e inmutable.

---

### Account

Representa una cuenta financiera del usuario.

```typescript
Account {
  id: UUID
  userId: UUID              // FK → User
  name: string              // "Cuenta BCP", "Efectivo", "BBVA Dólares"
  type: AccountType         // checking | savings | cash | credit_card | investment
  currency: Currency        // PEN | USD | EUR
  balance: number           // Saldo actual (calculado, no manual)
  color: string | null      // Color hex para UI: "#4CAF50"
  icon: string | null       // Nombre de ícono: "wallet", "credit-card"
  isArchived: boolean       // Ocultar sin borrar
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
```

**Reglas de negocio:**
- Un usuario puede tener múltiples cuentas en diferentes monedas.
- El `balance` se recalcula sumando todas las transacciones no eliminadas de la cuenta.
- No se puede archivar una cuenta con deudas/préstamos activos pendientes.
- No se puede eliminar (soft delete) una cuenta con transacciones no saldadas.
- `balance` nunca se modifica directamente en la entidad Account — solo a través de transacciones.

**AccountType:**
| Tipo | Descripción |
|---|---|
| `checking` | Cuenta corriente bancaria |
| `savings` | Cuenta de ahorros |
| `cash` | Efectivo en mano |
| `credit_card` | Tarjeta de crédito (balance puede ser negativo) |
| `investment` | Inversiones, fondos |

---

### RefreshToken

```typescript
RefreshToken {
  id: UUID
  userId: UUID
  token: string             // Hash del token (nunca el token en claro)
  expiresAt: Date
  revokedAt: Date | null    // null = activo
  createdAt: Date
}
```

**Reglas de negocio:**
- Al hacer logout se revoca el refresh token (setea `revokedAt`).
- Al rotar el token (nuevo access token), se revoca el viejo y se crea uno nuevo.
- Tokens expirados o revocados son ignorados (no eliminados, para auditoría).

---

## Value Objects

### Money

Encapsula un monto con su moneda. Previene operaciones entre monedas distintas sin conversión explícita.

```typescript
class Money {
  constructor(
    readonly amount: number,   // Siempre positivo en el VO; el signo lo da la transacción
    readonly currency: Currency,
  ) {
    if (amount < 0) throw new DomainException('INVALID_MONEY_AMOUNT', 'Money amount cannot be negative');
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new DomainException('CURRENCY_MISMATCH', 'Cannot add Money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### AccountType (enum con lógica)

```typescript
enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  INVESTMENT = 'investment',
}

// Helper: ¿puede tener balance negativo?
function allowsNegativeBalance(type: AccountType): boolean {
  return type === AccountType.CREDIT_CARD;
}
```

---

## Invariantes de dominio

Estas reglas se validan en los use cases, **no** en los controllers ni en la capa de infraestructura.

| # | Regla | Módulo |
|---|---|---|
| 1 | Un usuario no puede tener dos cuentas con el mismo nombre | Account |
| 2 | El saldo de una cuenta no puede ser negativo, excepto tarjetas de crédito | Account |
| 3 | No se puede eliminar una cuenta con transacciones activas (no soft-deleted) | Account |
| 4 | El email de un usuario es inmutable tras el registro | User |
| 5 | No se puede crear un refresh token para un usuario inactivo | Auth |

---

## Mejoras respecto a v1

### Separación entidad-ORM

En v1 la entidad era directamente la entidad TypeORM. En v2:
- La entidad de dominio (`Account`) es una clase TypeScript pura.
- La entidad ORM (`AccountOrmEntity`) tiene todos los decoradores de TypeORM.
- El repositorio hace el mapeo entre ambas.

**Beneficio:** la lógica de negocio no depende de TypeORM. Se puede testear sin base de datos.

### Balance calculado vs. campo actualizado manualmente

En v1 el balance se actualizaba con `+=` directo. Problema: race conditions bajo concurrencia.

En v2:
- El balance en `accounts` es una **vista materializada** que se recalcula desde las transacciones.
- Para operaciones críticas (mover dinero entre cuentas), usar transacciones de base de datos con `QueryRunner`.

### `isArchived` en lugar de solo soft delete

En v1, solo existía `deletedAt`. El usuario no podía "ocultar" una cuenta sin borrarla.
En v2: `isArchived: true` la esconde de las listas pero mantiene el historial completo.

### Color e ícono en Account

Mejora de UX: el usuario puede personalizar la apariencia de cada cuenta desde la creación.

---

## Glosario del dominio (v2)

| Término | Definición |
|---|---|
| `Account` | Cuenta financiera perteneciente a un usuario |
| `AccountType` | Clasificación funcional de la cuenta (checking, savings, etc.) |
| `Currency` | Moneda de la cuenta (PEN, USD, EUR) |
| `balance` | Saldo actual calculado a partir de las transacciones |
| `isArchived` | Cuenta oculta pero no eliminada; mantiene su historial |
| `RefreshToken` | Token de larga duración que permite renovar el access token |
| `JwtPayload` | Contenido del JWT: `{ sub: userId, email, iat, exp }` |
| `Money` | Value object que combina monto y moneda |
| `DomainException` | Error lanzado por violación de invariante de dominio |
