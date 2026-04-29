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

---

## Módulo Monthly Services

### MonthlyService

Representa un servicio recurrente que el usuario paga mes a mes (Netflix, gym, internet, etc.).

```typescript
MonthlyService {
  id: UUID
  userId: UUID                    // FK → User
  name: string                    // "Netflix", "Gimnasio"
  defaultAccountId: UUID          // FK → Account — cuenta habitual de pago
  categoryId: UUID                // FK → Category — categoría de la transacción generada
  currency: string                // ISO 4217, inmutable, debe coincidir con defaultAccount
  estimatedAmount: number | null  // Recalculado como AVG de las últimas 3 tx al pagar
  dueDay: number | null           // 1..31, informativo para UI
  startPeriod: string             // YYYY-MM — primer período a pagar, inmutable
  lastPaidPeriod: string | null   // YYYY-MM — último mes cubierto, null si nunca se pagó
  isActive: boolean               // false = archivado
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null          // Reservado para futuro; hoy el delete es hard
}
```

**Valores calculados (no persistidos):**

- `nextDuePeriod`: si `lastPaidPeriod` es null → `startPeriod`; si no → `lastPaidPeriod + 1 mes`.
- `isOverdue`: `nextDuePeriod < currentMonthInUserTz`.
- `isPaidForCurrentMonth`: `nextDuePeriod > currentMonthInUserTz`.

Los tres se calculan en cada respuesta usando la timezone del header `x-timezone`.

**Reglas de negocio:**

1. La moneda del servicio es **inmutable** después de crearlo — transacciones y cuentas dependen de ella.
2. `startPeriod` es **inmutable** — cambia el "origen" del scheduler y rompe la historia.
3. Un usuario no puede tener dos servicios **activos** con el mismo nombre (índice parcial único en DB).
4. Archivar un servicio no borra las transacciones vinculadas — el ledger queda intacto.
5. `DELETE` sólo procede si el servicio **no tiene** transacciones vinculadas (`MSVC_001` en caso contrario).
6. Pagar un servicio:
   - Crea una `Transaction EXPENSE` con `monthlyServiceId` apuntando al servicio.
   - Debita la cuenta elegida (default u `accountIdOverride`).
   - Avanza `lastPaidPeriod` al `nextDuePeriod` que se acaba de facturar.
   - Recalcula `estimatedAmount` = AVG de las últimas 3 transacciones del servicio.
7. Saltear un mes sólo avanza `lastPaidPeriod`; no afecta balance ni crea transacción.

**Invariantes de dominio:**

| #  | Regla                                                                    | Módulo          |
|----|--------------------------------------------------------------------------|-----------------|
| 11 | La moneda del servicio = la moneda de la cuenta por defecto              | MonthlyService  |
| 12 | La moneda no cambia después de creado                                    | MonthlyService  |
| 13 | `startPeriod` no cambia después de creado                                | MonthlyService  |
| 14 | Nombres de servicios activos únicos por usuario                          | MonthlyService  |
| 15 | Un servicio con transacciones vinculadas no puede eliminarse (sólo archivarse) | MonthlyService  |

**Relación con `Transaction`:**

- `transactions.monthlyServiceId` (`UUID`, nullable) referencia a `monthly_services(id)`.
- `ON DELETE SET NULL` — si el servicio se elimina (caso raro, sin pagos), las referencias quedan en null.
- Las transacciones generadas por `POST /monthly-services/:id/pay` son `EXPENSE` normales, aparecen
  en la lista general y en los reportes de finanzas como cualquier otro gasto.

## Módulo Chores (Tareas recurrentes no diarias)

### Chore

Tarea de mantenimiento o rutina hogareña con cadencia libre — días, semanas, meses o años. NO se
mide por completitud diaria (eso son los `Habit`s); una `Chore` simplemente "se hizo" o "todavía
no", y el sistema sabe cuándo toca de vuelta.

```typescript
Chore {
  id: UUID
  userId: UUID                    // FK → User
  name: string                    // "Lavar sábanas", "Rotar neumáticos"
  notes: string | null            // texto libre (≤2000 chars)
  category: string | null         // tag libre, ≤50 chars
  intervalValue: number           // entero positivo (ej. 2)
  intervalUnit: 'days'|'weeks'|'months'|'years'
  startDate: string               // YYYY-MM-DD — semilla del primer ciclo, inmutable
  lastDoneDate: string | null     // YYYY-MM-DD — null si nunca se hizo
  nextDueDate: string             // YYYY-MM-DD — persistido, editable manualmente
  isActive: boolean               // false = archivada
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null          // soft delete
}
```

**Valores calculados (no persistidos):**

- `isOverdue`: `nextDueDate < currentDateInUserTz`. El frontend puede recalcular `isUpcoming` y
  bandas de proximidad client-side; el backend sólo expone `isOverdue` para tests/consistencia.

### ChoreLog

Registro de un evento de "hecho". Inmutable después del insert (no hay edición en v1).

```typescript
ChoreLog {
  id: UUID
  choreId: UUID                   // FK → Chore (ON DELETE CASCADE)
  doneAt: string                  // YYYY-MM-DD — el día se entiende en la TZ del usuario
  note: string | null             // texto libre (≤500 chars)
  createdAt: Date
}
```

**Reglas de negocio (firmadas v1):**

1. **Create**: `nextDueDate = startDate`. `lastDoneDate = null`.
2. **Mark done** (`POST /chores/:id/done`):
   - `doneAt` default = hoy en la TZ del cliente.
   - Crea `ChoreLog` con `doneAt + note?`.
   - `lastDoneDate = doneAt`.
   - `nextDueDate = doneAt + interval` (regla A — la cadencia se reanuda desde la fecha real
     de hecho, NO desde el `nextDueDate` previo).
3. **Skip** (`POST /chores/:id/skip`): `nextDueDate += interval`. NO crea log, NO toca
   `lastDoneDate`.
4. **Update** `intervalValue`/`intervalUnit`: NO recalcula `nextDueDate`. El usuario puede ajustar
   `nextDueDate` manualmente vía PATCH si quiere — decisión firmada (predecible > "mágico").
5. **Update** con `nextDueDate`: lo asigna directo (después de validar formato `YYYY-MM-DD`).
6. **Delete**: bloqueado con `409 CHRE_001` si la chore tiene logs. Sin logs → soft delete.
7. **Archive**: toggle `isActive`. Los logs históricos quedan intactos.

**Aritmética de fechas (helper `addInterval`):**

- `days` / `weeks`: suma directa en UTC para evitar saltos por DST.
- `months`: usa `Date(year, monthIndex, day)` con clamp manual del día (Jan 31 + 1 mes = Feb 28
  o Feb 29 según año bisiesto, NUNCA Mar 3).
- `years`: idem, con clamp para Feb 29 (Feb 29 + 1 año = Feb 28 si el target no es bisiesto).

**Invariantes de dominio:**

| #  | Regla                                                                       | Módulo |
|----|-----------------------------------------------------------------------------|--------|
| 16 | `intervalValue > 0`                                                         | Chore  |
| 17 | `intervalUnit ∈ {days, weeks, months, years}`                               | Chore  |
| 18 | Una chore con logs no puede eliminarse (sólo archivarse)                    | Chore  |
| 19 | `startDate` no cambia después de creada                                     | Chore  |
