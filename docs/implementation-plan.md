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

- [ ] `Account` domain entity con métodos `credit()`, `debit()`, `archive()`, `isDeleted()`
- [ ] `AccountType` enum
- [ ] `Currency` enum
- [ ] `Money` value object
- [ ] `AccountRepository` abstract class
- [ ] `DomainError` para violaciones de invariante

### 2.2 Aplicación

- [ ] `CreateAccountUseCase`
  - Valida nombre único por usuario
  - Inicializa balance con `initialBalance` (default 0)
- [ ] `GetAccountsUseCase`
  - Filtra por `userId`
  - Soporte para `includeArchived` (default false)
- [ ] `GetAccountByIdUseCase`
  - Valida que la cuenta pertenezca al usuario autenticado
- [ ] `UpdateAccountUseCase`
  - Solo permite actualizar: nombre, color, ícono
  - No permite cambiar `currency` si tiene transacciones
- [ ] `ArchiveAccountUseCase`
  - Valida que no tenga deudas/préstamos activos
- [ ] `DeleteAccountUseCase`
  - Valida que no tenga transacciones activas
  - Soft delete

### 2.3 Infraestructura

- [ ] `AccountOrmEntity`
- [ ] `AccountRepositoryImpl`
- [ ] Migración: `CreateAccountsTable`

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

- [ ] Tests unitarios: todos los use cases (mock del repositorio)
- [ ] Tests e2e: flujo completo con base de datos real (ver [testing.md](testing.md))

**Criterio de completitud:** todos los endpoints documentados en Swagger, cobertura >80% en use cases.

---

## Fase 3 — Refinamiento y estabilización

**Objetivo:** producción-ready antes de agregar más módulos.

- [ ] `.env.example` completo y documentado
- [ ] `README.md` con instrucciones de setup local
- [ ] Health check endpoint: `GET /health`
- [ ] Logging estructurado en todos los use cases críticos
- [ ] Manejo de errores consistente (mapa de `DomainError` → HTTP status)
- [ ] Rate limiting ajustado por endpoint
- [ ] Cobertura global de tests >70%

---

## Orden de dependencias entre módulos

```
ConfigModule + DatabaseModule (Fase 0)
       ↓
  UsersModule (Fase 1.1)
       ↓
   AuthModule (Fase 1.2)
       ↓
 AccountsModule (Fase 2)
       ↓
[TransactionsModule — próxima versión]
```

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

## Lo que NO se implementa en v2 inicial

Para mantener el foco, estas features quedan fuera del alcance actual:

- Daily Planner
- Transacciones (Fase 3 futura)
- Notificaciones push
- Multi-moneda con conversión
- Exportación CSV
- Roles y permisos granulares
- Presupuestos por categoría
