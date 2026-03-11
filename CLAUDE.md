# CLAUDE.md — Habit Sumaq v2

Guía de reglas para Claude Code al trabajar en este proyecto.

## Documentos de referencia

- [Arquitectura limpia](docs/architecture.md) — Estructura de directorios, capas, patrones
- [Plan de implementación](docs/implementation-plan.md) — Fases, orden de desarrollo
- [Modelo de dominio](docs/business-model.md) — Entidades, lógica de negocio, reglas
- [Estrategia de testing](docs/testing.md) — Tipos de tests, convenciones
- [Convenciones de API](docs/api-conventions.md) — Endpoints, DTOs, respuestas

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 |
| Lenguaje | TypeScript 5.7 (strict) |
| ORM | TypeORM + PostgreSQL |
| Cache / sesiones | Redis (ioredis) — refresh tokens |
| Validación | class-validator + class-transformer |
| Autenticación | Passport.js + Google OAuth 2.0 + JWT |
| Documentación | @nestjs/swagger (OpenAPI 3) |
| Testing | Jest (unit) + Supertest (e2e) |
| Logging | Pino (@nestjs/pino) |
| Config | @nestjs/config + Zod validation |
| Package manager | pnpm |

---

## Reglas generales

### Lo que SIEMPRE debes hacer

1. **Leer antes de modificar** — Nunca editar un archivo sin haberlo leído primero.
2. **Seguir la arquitectura de capas** — Ver [architecture.md](docs/architecture.md). Cada módulo tiene `domain/`, `application/`, `infrastructure/`, `presentation/`.
3. **Usar `ApiResponse<T>`** — Todos los endpoints retornan este wrapper. Ver [api-conventions.md](docs/api-conventions.md).
4. **Generar migraciones** — Nunca usar `synchronize: true`. Cada cambio de esquema requiere `pnpm typeorm migration:generate`.
5. **Tests obligatorios** — Todo servicio de aplicación tiene test unitario. Todo endpoint crítico tiene test e2e. Ver [testing.md](docs/testing.md).
6. **Documentar con Swagger** — Cada `@Controller` y cada `@Get/@Post/...` lleva decoradores `@ApiTags`, `@ApiOperation`, `@ApiResponse`.
7. **Soft delete** — Nunca borrar registros de dominio con `DELETE` físico. Usar `deletedAt` con `@DeleteDateColumn()`.

### Lo que NUNCA debes hacer

1. **No usar `synchronize: true`** en TypeORM — en ningún ambiente.
2. **No poner lógica de negocio en controllers** — Solo orquestación HTTP (llamar al servicio, mapear respuesta).
3. **No acceder a la DB desde un controller** — Pasar siempre por el servicio de aplicación.
4. **No devolver entidades ORM directamente** — Mapear siempre a DTOs de respuesta.
5. **No hardcodear secrets** — Toda config sensible va en `.env` y se valida con Zod en `ConfigModule`.
6. **No omitir validación de entrada** — Todo body, param y query decorado con `class-validator` y transformado con `ValidationPipe`.
7. **No importar entre módulos de feature directamente** — Comunicación entre módulos vía servicios exportados o eventos.
8. **No crear helpers de un solo uso** — Si algo se usa una vez, queda inline. Si se reutiliza 2+, va a `common/`.

---

## Estructura de módulo canónica

```
src/modules/<feature>/
  domain/
    <feature>.entity.ts          # Entidad de dominio pura (sin decoradores ORM)
    <feature>.repository.ts      # Interfaz del repositorio (abstract class)
    value-objects/               # Value objects si aplica
  application/
    use-cases/
      create-<feature>.use-case.ts
      update-<feature>.use-case.ts
      ...
    dto/
      create-<feature>.dto.ts
      update-<feature>.dto.ts
      <feature>-response.dto.ts
  infrastructure/
    persistence/
      <feature>.orm-entity.ts    # Entidad TypeORM con decoradores
      <feature>.repository.impl.ts  # Implementación del repositorio
  presentation/
    <feature>.controller.ts
    <feature>.module.ts
```

---

## Convenciones de código

- **Nombres en inglés** — código, variables, clases, métodos, rutas de archivo.
- **Contenido del dominio en español** — mensajes de error, comentarios de negocio, documentación Swagger.
- **camelCase** para variables y funciones, **PascalCase** para clases e interfaces.
- **kebab-case** para nombres de archivo: `create-account.use-case.ts`.
- **SCREAMING_SNAKE_CASE** para constantes de dominio: `MAX_ACCOUNTS_PER_USER`.
- Trailing comma, single quotes (ver `.prettierrc`).
- Importaciones absolutas con path aliases: `@modules/accounts/...`, `@common/...`.

---

## Variables de entorno requeridas

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=habit_sumaq
DB_USER=postgres
DB_PASSWORD=secret

# JWT
JWT_ACCESS_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

## Comandos frecuentes

```bash
# Desarrollo
pnpm start:dev

# Generar migración
pnpm typeorm migration:generate src/database/migrations/<NombreMigracion>

# Correr migraciones
pnpm typeorm migration:run

# Revertir última migración
pnpm typeorm migration:revert

# Tests unitarios
pnpm test

# Tests e2e
pnpm test:e2e

# Cobertura
pnpm test:cov

# Lint
pnpm lint
```
