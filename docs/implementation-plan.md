# Plan de Implementación — Habit Sumaq v2

## Principio

Construir de adentro hacia afuera: **base sólida antes de features**. Cada fase termina con algo funcional y testeado.

---

## Fase 0 — Fundamentos del proyecto

**Objetivo:** tener la infraestructura base lista para que cualquier módulo pueda construirse encima.

### 0.1 Dependencias

```bash
# Core NestJS
pnpm add @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/swagger
pnpm add @nestjs/typeorm typeorm pg

# Autenticación
pnpm add passport passport-google-oauth20 passport-jwt
pnpm add @types/passport-google-oauth20 @types/passport-jwt -D

# Validación
pnpm add class-validator class-transformer

# Logging
pnpm add nestjs-pino pino-http pino-pretty

# Seguridad
pnpm add helmet @nestjs/throttler cookie-parser
pnpm add @types/cookie-parser -D

# Validación de config
pnpm add zod

# Testing
pnpm add @nestjs/testing supertest @types/supertest -D
```

### 0.2 Configuración global

- [x] `ConfigModule` global con validación Zod (`.env` + schema)
- [x] `TypeOrmModule` configurado con `synchronize: false`
- [x] `DataSource` separado para CLI de migraciones (`src/database/data-source.ts`)
- [x] Scripts en `package.json`: `migration:generate`, `migration:run`, `migration:revert`
- [x] Path aliases en `tsconfig.json`: `@modules/*`, `@common/*`, `@config/*`
- [x] `ValidationPipe` global (whitelist, transform, forbidNonWhitelisted)
- [x] `AllExceptionsFilter` global
- [x] `ResponseTransformInterceptor` global
- [x] Swagger configurado en `/docs`
- [x] CORS con `FRONTEND_URL` desde config
- [x] Helmet habilitado
- [x] ThrottlerModule (rate limiting por IP)
- [x] PinoLogger configurado

### 0.3 Estructura base

- [x] `src/common/dto/api-response.dto.ts`
- [x] `src/common/filters/all-exceptions.filter.ts`
- [x] `src/common/interceptors/response-transform.interceptor.ts`
- [x] `src/common/guards/jwt-auth.guard.ts`
- [x] `src/common/decorators/current-user.decorator.ts`
- [x] `src/common/decorators/public.decorator.ts`
- [x] `src/common/exceptions/domain.exception.ts`

**Criterio de completitud:** `pnpm start:dev` sin errores, `/docs` muestra Swagger vacío. ✅

---

## Fase 1 — Autenticación con Google OAuth

**Objetivo:** usuario puede loguearse con Google y recibir JWT funcional.

### 1.1 Módulo Users

- [x] `User` domain entity
- [x] `UserRepository` abstract class
- [x] `UserOrmEntity` con `@Entity('users')` y `@DeleteDateColumn`
- [x] `UserRepositoryImpl`
- [x] `FindOrCreateUserUseCase` — busca por `googleId`, si no existe crea el registro
- [x] `GetUserProfileUseCase`
- [x] `UserResponseDto` con `fromDomain()`
- [x] Migración: `CreateUsersTable`
- [x] Tests unitarios de `FindOrCreateUserUseCase`

### 1.2 Módulo Auth

- [x] `RefreshToken` domain entity (sin ORM — almacenado en Redis)
- [x] `RefreshTokenRepository`
- [x] `GoogleStrategy` (passport-google-oauth20)
- [x] `JwtAccessStrategy` (passport-jwt, header Bearer)
- [x] `JwtRefreshStrategy` (passport-jwt, cookie httpOnly)
- [x] `GoogleLoginUseCase` — recibe perfil Google, llama a FindOrCreateUser, genera tokens
- [x] `RotateRefreshTokenUseCase` — valida refresh, rota token, retorna nuevo access
- [x] `LogoutUseCase` — revoca refresh token
- [x] ~~Migración: `CreateRefreshTokensTable`~~ — no aplica, refresh tokens en Redis (TTL automático)
- [x] Tests unitarios de los 3 use cases

### 1.3 Endpoints Auth

```
GET  /auth/google            → Inicia flujo OAuth (público)
GET  /auth/google/callback   → Callback de Google (público)
POST /auth/refresh           → Rota access token (lee cookie refresh)
POST /auth/logout            → Revoca refresh token
GET  /auth/me                → Perfil del usuario autenticado
```

**Criterio de completitud:** flujo completo end-to-end testeado manualmente + tests e2e de `/auth/me`. ✅

---

## Fase 2 — Módulo Accounts

**Objetivo:** CRUD completo de cuentas financieras con balance correcto.

### 2.1 Dominio

- [x] `Account` domain entity con métodos `credit()`, `debit()`, `archive()`, `isDeleted()`
- [x] `AccountType` enum
- [x] `Currency` enum
- [x] `Money` value object
- [x] `AccountRepository` abstract class
- [x] `DomainError` para violaciones de invariante

### 2.2 Aplicación

- [x] `CreateAccountUseCase`
- [x] `GetAccountsUseCase`
- [x] `GetAccountByIdUseCase`
- [x] `UpdateAccountUseCase`
- [x] `ArchiveAccountUseCase`
- [x] `DeleteAccountUseCase`

### 2.3 Infraestructura

- [x] `AccountOrmEntity`
- [x] `AccountRepositoryImpl`
- [x] Migración: `CreateAccountsTable`

### 2.4 Endpoints

```
POST   /accounts              → Crear cuenta
GET    /accounts              → Listar cuentas del usuario
GET    /accounts/:id          → Obtener cuenta por ID
PATCH  /accounts/:id          → Actualizar nombre/color/icono
PATCH  /accounts/:id/archive  → Archivar cuenta
DELETE /accounts/:id          → Soft delete
```

### 2.5 Tests

- [x] Tests unitarios: todos los use cases (mock del repositorio)
- [ ] Tests e2e: flujo completo con base de datos real (ver [testing.md](testing.md))

**Criterio de completitud:** todos los endpoints documentados en Swagger, cobertura >80% en use cases. ✅

---

## Fase 3 — Refinamiento y estabilización

**Objetivo:** producción-ready antes de agregar más módulos.

- [x] `.env.example` completo y documentado
- [x] `README.md` con instrucciones de setup local
- [x] Health check endpoint: `GET /health`
- [x] Logging estructurado en use cases críticos (`GoogleLoginUseCase`, `CreateAccountUseCase`)
- [x] Manejo de errores consistente (mapa de `DomainError` → HTTP status)
- [x] Rate limiting ajustado por endpoint (`@SkipThrottle` en OAuth, `@Throttle` en `/auth/refresh`)
- [x] Cobertura global de tests >70% — **83% statements, 74% branches** ✅

---

## Fase 4 — Módulo Categories

**Objetivo:** CRUD de categorías de ingresos y gastos, prerequisito para Transactions.

### 4.1 Dominio

- [x] `Category` domain entity con métodos `updateProfile()`, `isDeleted()`
- [x] `CategoryType` enum (`INCOME | EXPENSE`)
- [x] `CategoryRepository` abstract class

### 4.2 Aplicación

- [x] `CreateCategoryUseCase`
- [x] `GetCategoriesUseCase` (con filtro opcional por tipo)
- [x] `GetCategoryByIdUseCase`
- [x] `UpdateCategoryUseCase`
- [x] `DeleteCategoryUseCase` (bloquea eliminación de categorías por defecto)

### 4.3 Infraestructura

- [x] `CategoryOrmEntity`
- [x] `CategoryRepositoryImpl`
- [x] Migración: `CreateCategoriesTable`

### 4.4 Endpoints

```
POST   /categories        → Crear categoría
GET    /categories        → Listar categorías (query: type)
GET    /categories/:id    → Obtener categoría por ID
PATCH  /categories/:id    → Actualizar nombre/color/ícono
DELETE /categories/:id    → Soft delete
```

### 4.5 Tests

- [x] Tests unitarios: todos los use cases
- [x] Tests de dominio: `Category` entity
- [x] Tests de DTO: `CategoryResponseDto.fromDomain()`
- [ ] Tests e2e: flujo completo con base de datos real

**Criterio de completitud:** todos los endpoints documentados en Swagger, cobertura >80% en use cases. ✅

---

## Fase 5 — Módulo Transactions

**Objetivo:** CRUD de transacciones (ingresos, gastos, transferencias) con actualización automática de balances.

### 5.1 Dominio

- [x] `Transaction` domain entity con métodos `isTransfer()`, `isDeleted()`
- [x] `TransactionType` enum (`INCOME | EXPENSE | TRANSFER`)
- [x] `TransactionRepository` abstract class (con `existsByAccountId`)

### 5.2 Aplicación

- [x] `CreateTransactionUseCase` — valida cuentas, actualiza balances (debit/credit), soporta transferencias
- [x] `GetTransactionsUseCase` (con filtros: account, category, type, dateFrom, dateTo)
- [x] `GetTransactionByIdUseCase`
- [x] `UpdateTransactionUseCase` — revierte balance antiguo y aplica nuevo cuando cambia el monto
- [x] `DeleteTransactionUseCase` — soft delete, revierte el efecto en balance de cuentas

### 5.3 Infraestructura

- [x] `TransactionOrmEntity` (`numeric(15,2)` con transformer)
- [x] `TransactionRepositoryImpl` (con filtros dinámicos via QueryBuilder)
- [x] Migración: `CreateTransactionsTable` (FKs a users, accounts, categories; índices en userId, accountId, date)

### 5.4 Endpoints

```
POST   /transactions        → Registrar transacción (ingreso/gasto/transferencia)
GET    /transactions        → Listar transacciones paginadas con filtros (query: page, limit, accountId, categoryId, type, status, dateFrom, dateTo)
GET    /transactions/:id    → Obtener transacción por ID
PATCH  /transactions/:id    → Actualizar monto, descripción, categoría, fecha
DELETE /transactions/:id    → Soft delete (revierte balance)
```

### 5.5 Tests

- [x] Tests unitarios: todos los use cases (29 tests)
- [x] Tests de dominio: `Transaction` entity, `TransactionResponseDto.fromDomain()`
- [x] Tests e2e: 16 tests (auth, CRUD, validación, errores de dominio)

**Criterio de completitud:** todos los endpoints documentados en Swagger, cobertura >80% en use cases, balances actualizados correctamente. ✅

---

## Fase 5.1 — Deudas y Préstamos (DEBT/LOAN)

**Objetivo:** registrar deudas y préstamos que no afectan balance, con liquidaciones parciales/totales.

### 5.1.1 Dominio

- [x] `TransactionType` ampliado con `DEBT | LOAN`
- [x] `TransactionStatus` enum (`PENDING | SETTLED`)
- [x] 4 nuevos campos en `Transaction`: `reference`, `status`, `relatedTransactionId`, `remainingAmount`
- [x] Métodos: `isDebtOrLoan()`, `isPending()`, `isSettled()`, `applySettlement()`, `revertSettlement()`
- [x] `TransactionRepository.findByRelatedTransactionId()`

### 5.1.2 Aplicación

- [x] `CreateTransactionUseCase` — branch DEBT/LOAN sin efecto en balance, valida `reference`
- [x] `SettleTransactionUseCase` — liquidación parcial/total, crea EXPENSE (DEBT) o INCOME (LOAN)
- [x] `UpdateTransactionUseCase` — bloquea edición de settled, actualiza `reference`, ajusta `remainingAmount`
- [x] `DeleteTransactionUseCase` — cascade delete de DEBT/LOAN + liquidaciones, revert settlement

### 5.1.3 Infraestructura

- [x] `TransactionOrmEntity` — 4 columnas nuevas + 2 índices
- [x] `TransactionRepositoryImpl` — mappeo + `findByRelatedTransactionId` + filtro `status`
- [x] Migración: `AddDebtLoanFields` (ALTER TYPE + 4 columnas + FK + 2 índices)

### 5.1.4 Endpoints

```
POST /transactions/:id/settle → Liquidar parcial/total una deuda o préstamo
```

### 5.1.5 Error codes

- [x] `REFERENCE_REQUIRED` (422)
- [x] `TRANSACTION_NOT_DEBT_OR_LOAN` (422)
- [x] `TRANSACTION_ALREADY_SETTLED` (409)
- [x] `CANNOT_UPDATE_SETTLED_TRANSACTION` (409)
- [x] `SETTLEMENT_AMOUNT_EXCEEDS_REMAINING` (422)
- [x] `AMOUNT_BELOW_SETTLED` (422)

### 5.1.6 Tests

- [x] Unit tests: SettleTransactionUseCase (10 tests), +3 create, +2 delete cascade, +3 update
- [x] Domain tests: entity (7 tests con applySettlement, revertSettlement, isDebtOrLoan, isPending, isSettled)
- [x] DTO tests: response DTO con 4 campos nuevos
- [x] E2e tests: DEBT creation, settle happy path, settle errors (422/409), cascade delete, settled update block

**Criterio de completitud:** 159 unit tests + 48 e2e tests passing, tsc clean, lint clean. ✅

---

## Criterios de "listo para producción" por módulo

Un módulo se considera listo cuando:
1. Todos sus use cases tienen tests unitarios
2. Sus endpoints críticos tienen tests e2e
3. Está documentado en Swagger
4. Usa migraciones reales (no synchronize)
5. No expone entidades ORM directamente (siempre DTOs de respuesta)
6. Los errores de dominio se traducen a HTTP responses correctas

---

## Fase 6 — Módulo Habits (Habit Tracker)

**Objetivo:** seguimiento de hábitos diarios/semanales con streaks y estadísticas.

### 6.1 Dominio

- [x] `Habit` domain entity con métodos `archive()`, `unarchive()`, `updateProfile()`, `isDeleted()`
- [x] `HabitLog` domain entity con métodos `updateCount()`, `isCompleted()`
- [x] `HabitFrequency` enum (`DAILY | WEEKLY`)
- [x] `HabitRepository` abstract class
- [x] `HabitLogRepository` abstract class

### 6.2 Aplicación

- [x] `CreateHabitUseCase` — valida nombre único por usuario
- [x] `GetHabitsUseCase` — lista hábitos activos con stats (streak, completionRate, todayLog)
- [x] `GetHabitByIdUseCase` — detalle con historial de logs reciente
- [x] `UpdateHabitUseCase` — actualizar nombre, descripción, targetCount, color, icon
- [x] `ArchiveHabitUseCase` — archivar/desarchivar
- [x] `DeleteHabitUseCase` — soft delete (cascade delete de logs)
- [x] `LogHabitUseCase` — crear o actualizar log del día (upsert por habitId+date)
- [x] `GetHabitLogsUseCase` — historial de logs con filtros (dateFrom, dateTo)
- [x] `GetDailySummaryUseCase` — resumen del día: todos los hábitos con su log de hoy
- [x] `StatsCalculator` — lógica pura de streaks y completionRate (daily + weekly)

### 6.3 Infraestructura

- [x] `HabitOrmEntity`
- [x] `HabitLogOrmEntity` (unique constraint: habitId + date)
- [x] `HabitRepositoryImpl`
- [x] `HabitLogRepositoryImpl`
- [x] Migración: `CreateHabitsTable`
- [x] Migración: `CreateHabitLogsTable`

### 6.4 Endpoints

```
POST   /habits              → Crear hábito
GET    /habits              → Listar hábitos con stats (query: includeArchived)
GET    /habits/daily        → Resumen diario (todos los hábitos + log de hoy)
GET    /habits/:id          → Detalle de hábito con stats
PATCH  /habits/:id          → Actualizar hábito
PATCH  /habits/:id/archive  → Archivar/desarchivar
DELETE /habits/:id          → Soft delete

POST   /habits/:id/logs     → Registrar/actualizar log del día
GET    /habits/:id/logs     → Historial de logs (query: dateFrom, dateTo, page, limit)
```

### 6.5 Error codes

- [x] `HABIT_NOT_FOUND` (404)
- [x] `HABIT_NAME_TAKEN` (409)
- [x] `HABIT_ARCHIVED` (422)
- [x] `HABIT_LOG_FUTURE_DATE` (422)
- [x] `INVALID_TARGET_COUNT` (422)
- [x] `HABIT_BELONGS_TO_OTHER_USER` (403)

### 6.6 Tests

- [x] Tests de dominio: `Habit` entity (11 tests), `HabitLog` entity (5 tests)
- [x] Tests unitarios: todos los use cases + StatsCalculator (50 tests)
- [x] Tests de DTO: `HabitResponseDto` (6 tests), `HabitLogResponseDto` (3 tests)
- [ ] Tests e2e: CRUD hábitos, logs, streaks, errores de dominio

**Criterio de completitud:** 255 unit tests passing (76 del módulo Habits), tsc clean, lint clean. ✅

---

## Fase 7 — Timezone en user-settings ✅

**Objetivo:** Guardar la IANA timezone del usuario como pre-requisito para features que razonan en "días del usuario" (cleanup diario en quick-tasks, rangos calendario-alineados en reports).

- [x] Columna `timezone varchar(64) NOT NULL DEFAULT 'UTC'` en `user_settings` (migración `AddTimezoneToUserSettings`)
- [x] Validador `@IsIanaTimezone()` en `src/common/validators/` — usa `Intl.DateTimeFormat` para rechazar garbage
- [x] Campo en `UpdateUserSettingsDto` + `UserSettingsResponseDto`
- [x] `UserSettings` domain entity + repo impl + factory + 16 tests
- [x] Default `'UTC'` permite a usuarios pre-existentes seguir sin cambios; el frontend auto-detecta en el primer login post-deploy

**Criterio de completitud:** PATCH con zona inválida → 400; PATCH con zona canónica → 200; tests unitarios verdes. ✅

---

## Fase 8 — Quick Tasks (Diarias) ✅

**Objetivo:** Módulo ligero de TODO diario con auto-cleanup timezone-aware.

- [x] `QuickTask` domain entity con invariantes (`title <= 120`, `description <= 5000`, título no vacío)
- [x] 5 endpoints: `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `PATCH /reorder`
- [x] **Hard delete** (excepción explícita a la convención global de soft delete — documentada en el use case y PR body)
- [x] Lazy cleanup en `GET /quick-tasks`: borra `completed + completedAt < startOfTodayInTimezone(user.timezone)`
- [x] Helper `startOfTodayInTimezone` en `src/modules/quick-tasks/infrastructure/timezone/` con tests sobre zonas DST (Madrid, Lima, Tokyo, fallback UTC)
- [x] Reorder acepta `orderedIds: UUID[]` y renumera 1..N en transacción
- [x] Códigos de error `QTK_001..006` mapeados en `DOMAIN_HTTP_MAP`
- [x] E2E suite con 10 casos (auth, CRUD, validation, reorder + ownership, lazy cleanup)

**Criterio de completitud:** 337 unit tests + 105 e2e pasando. ✅

---

## Fase 9 — Reportes (Dashboards agregados) ✅

**Objetivo:** Endpoints de agregación por módulo (Finanzas, Rutinas) con `period` configurable. Sin tablas nuevas — solo queries sobre las entidades existentes.

- [x] Módulo `reports/` con estructura Clean Arch pero sin `domain/entity` (los reports son derivados, no persistidos)
- [x] `GET /api/v1/reports/finances-dashboard?period=week|30d|month|3m`
- [x] `GET /api/v1/reports/routines-dashboard?period=...`
- [x] Helper `computePeriodRange(period, timezone, startOfWeek)` en `src/modules/reports/application/utils/`, Intl-based, tested con DST
- [x] Extensiones en `TransactionRepository`: `sumFlowByCurrencyInRange`, `topExpenseCategoriesInRange`, `dailyNetFlowInRange` (raw SQL + JOIN con accounts para agrupar por moneda)
- [x] Reuso de `StatsCalculator` y `aggregateDebtsByReference` para no duplicar lógica
- [x] `HabitsModule` y `QuickTasksModule` ahora exportan sus repositorios para ser consumidos por `ReportsModule`
- [x] E2E: 4 casos por endpoint (401, empty, wired data, 400 on bad period)

**Criterio de completitud:** 355 unit tests + 112 e2e pasando, respuestas correctas sobre data real. ✅

---

## Orden de dependencias entre módulos (actualizado)

```
ConfigModule + DatabaseModule (Fase 0)
       ↓
  UsersModule (Fase 1.1) ─────────────────────── [exporta UserSettingsRepository]
       ↓
   AuthModule (Fase 1.2)
       ↓
 AccountsModule (Fase 2) ───────────────────────┐
       ↓                                         │
CategoriesModule (Fase 4)                        │
       ↓                                         │
TransactionsModule (Fase 5)  ───────────────────┤
       ↓ [reuso]                                 │
  ReportsModule (Fase 9) ←───────────────────────┤
                                                 │
  UsersModule (Fase 1.1)                         │
       ↓                                         │
  HabitsModule (Fase 6) ─────────────────────────┤
       ↓                                         │
QuickTasksModule (Fase 8) ←───────────────────────┘
       ↑
  Fase 7 (timezone en user-settings) es pre-requisito de Fase 8 y Fase 9
```

---

## Fase 10 — Monthly Services

**Objetivo:** Módulo para trackear servicios recurrentes (Netflix, gym, internet, etc.). Por ahora el pago es **manual** — el usuario marca "pagar" y se crea una `Transaction EXPENSE` vinculada al servicio. El scheduler automático queda para el backlog.

- [x] Migración `CreateMonthlyServicesTable` con unique index parcial `(userId, name) WHERE isActive = true`
- [x] Migración `AddMonthlyServiceIdToTransactions` + índice + FK `ON DELETE SET NULL`
- [x] `MonthlyService` domain entity con helpers `nextDuePeriod`, `isOverdueFor`, `isPaidForMonth`, `markPeriodAsPaid`, `toggleActive`, `addMonth`
- [x] `MonthlyServiceRepository` + `MonthlyServiceOrmEntity` + `MonthlyServiceRepositoryImpl`
- [x] Extensión de `TransactionRepository`: `countByMonthlyServiceId`, `findLastNByMonthlyServiceId` (para el recalculo de `estimatedAmount`)
- [x] `TransactionOrmEntity` y `Transaction` domain propagan `monthlyServiceId`
- [x] DTOs: `CreateMonthlyServiceDto`, `UpdateMonthlyServiceDto` (omite currency y startPeriod), `PayMonthlyServiceDto`, `SkipMonthDto`, `MonthlyServiceResponseDto` con campos calculados
- [x] Use cases: List, Get, Create, Update, Pay, Skip, Archive (toggle), Delete (hard delete condicional)
- [x] 8 endpoints con `JwtAuthGuard` y Swagger completo
- [x] Error codes `MSVC_001..003` agregados a `ERROR_CODES` y `DOMAIN_HTTP_MAP`
- [x] Helper `currentPeriodInTimezone` en `src/modules/monthly-services/infrastructure/timezone/` — resuelve el mes actual (YYYY-MM) en la timezone del cliente (header `x-timezone`)
- [x] Pago crea `Transaction EXPENSE` con `monthlyServiceId`, debita la cuenta, avanza `lastPaidPeriod` y recalcula `estimatedAmount` como AVG de las últimas 3 tx
- [x] Skip avanza período sin afectar balance
- [x] Delete condicional: 409 `MSVC_001` si hay pagos registrados — forzar archivar en su lugar
- [x] `CategoriesModule` ahora exporta `CategoryRepository` (se usa desde monthly-services)
- [x] Tests unitarios: 42 tests cubriendo los 8 use cases + happy path + errores de dominio
- [x] Tests e2e: CRUD, pay/skip/archive, guardas de ownership y de borrado con pagos

**Criterio de completitud:** tsc limpio, lint limpio, 42 tests del módulo + regresión de transactions/reports intacta. ✅

---

## Lo que NO se implementa (backlog post-MVP actual)

- Presupuestos por categoría con alertas
- Vinculación hábitos ↔ transacciones (hábitos con costo asociado)
- Daily Planner / Schedule
- Scheduler automático de pagos de servicios mensuales (hoy es manual)
- Notificaciones push (incluye alertas de servicios vencidos)
- Multi-moneda con conversión automática
- Exportación / importación CSV-JSON
- Roles y permisos granulares
- Historial de quick-tasks completadas (hoy se pierden al cleanup; requiere tabla de log dedicada)
- Heatmap anual en el dashboard de Rutinas (hoy solo en la página de hábitos)
