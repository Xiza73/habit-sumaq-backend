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

---

## Módulo Habit Tracker

### Habit

Representa un hábito que el usuario quiere construir o mantener.

```typescript
Habit {
  id: UUID
  userId: UUID              // FK → User
  name: string              // "Tomar 8 vasos de agua", "Ejercicio 30min"
  description: string | null
  frequency: HabitFrequency // daily | weekly
  targetCount: number       // Cantidad objetivo por período (ej: 8 vasos, 3 veces/semana)
  color: string | null      // Color hex para UI: "#2196F3"
  icon: string | null       // Nombre de ícono: "water", "dumbbell"
  isArchived: boolean       // Ocultar sin borrar
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
```

**Reglas de negocio:**
- Un usuario no puede tener dos hábitos activos con el mismo nombre.
- `targetCount` debe ser ≥ 1.
- Un hábito archivado no aparece en la vista diaria, pero mantiene su historial.
- Soft delete mantiene el historial de logs asociados.

**HabitFrequency:**
| Tipo | Descripción |
|---|---|
| `daily` | Se completa cada día |
| `weekly` | Se completa X veces por semana |

---

### HabitLog

Registro de cumplimiento de un hábito en una fecha específica.

```typescript
HabitLog {
  id: UUID
  habitId: UUID             // FK → Habit
  userId: UUID              // FK → User (denormalizado para queries eficientes)
  date: string              // Solo fecha, formato YYYY-MM-DD (string para evitar conversión de zona horaria)
  count: number             // Cantidad realizada, limitada a targetCount (ej: 5 vasos de 8)
  completed: boolean        // true si count >= habit.targetCount
  note: string | null       // Nota opcional del día
  createdAt: Date
  updatedAt: Date
}
```

**Reglas de negocio:**
- Solo puede existir un log por hábito por fecha (unique: habitId + date).
- `count` debe ser ≥ 0 y se limita automáticamente al `targetCount` del hábito (no puede excederlo).
- `completed` se calcula automáticamente: `count >= habit.targetCount`.
- No se puede crear un log para un hábito archivado o eliminado.
- No se puede crear un log para una fecha futura.
- El campo `date` se maneja como string `YYYY-MM-DD` en toda la cadena (DTO → dominio → ORM → PostgreSQL) para evitar desplazamientos por zona horaria que ocurrían al usar `Date`.

---

### Valores computados (no persistidos)

```typescript
HabitWithStats {
  ...Habit
  currentStreak: number     // Días/semanas consecutivos completados hasta hoy
  longestStreak: number     // Máximo streak histórico
  completionRate: number    // % de días/semanas completados en los últimos 30 días
  todayLog: HabitLog | null // Log de hoy (si existe)
  periodCount: number       // Conteo acumulado en el período actual (día para DAILY, semana para WEEKLY)
  periodCompleted: boolean  // true si periodCount >= targetCount
}
```

**Reglas de cálculo:**
- **currentStreak**: se recorre hacia atrás desde hoy. Si hoy no está completado, el streak es 0 (o se cuenta desde ayer si el día aún no termina — configurable).
- **longestStreak**: máximo histórico de días consecutivos completados.
- **completionRate (daily)**: días completados / últimos 30 días.
- **completionRate (weekly)**: semanas con ≥ targetCount logs completados / últimas 4 semanas.
- **periodCount (daily)**: `todayLog.count` (conteo de hoy).
- **periodCount (weekly)**: suma de `count` de todos los logs de la semana actual (lunes a domingo).
- **periodCompleted**: `periodCount >= targetCount`. Permite al frontend saber si la meta del período ya se cumplió, incluso si `todayLog` es null o tiene count 0.

---

### Invariantes de dominio (Habit Tracker)

| # | Regla | Módulo |
|---|---|---|
| 6 | Un usuario no puede tener dos hábitos activos con el mismo nombre | Habit |
| 7 | targetCount debe ser ≥ 1 | Habit |
| 8 | Solo un log por hábito por fecha | HabitLog |
| 9 | No se puede registrar un log para fecha futura | HabitLog |
| 10 | No se puede registrar un log en un hábito archivado o eliminado | HabitLog |

---

### Glosario del dominio (Habit Tracker)

| Término | Definición |
|---|---|
| `Habit` | Hábito recurrente que el usuario quiere mantener |
| `HabitLog` | Registro de cumplimiento de un hábito en una fecha |
| `HabitFrequency` | Frecuencia del hábito: diario o semanal |
| `targetCount` | Cantidad objetivo que define "completado" en un período |
| `currentStreak` | Racha actual de períodos consecutivos completados |
| `completionRate` | Porcentaje de cumplimiento en los últimos 30 días |
