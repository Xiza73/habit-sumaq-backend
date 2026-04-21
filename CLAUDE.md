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
PORT=3010
APP_URL=http://localhost:3010

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

## Auditoría obligatoria al completar un feature

Al terminar cualquier feature (módulo, use case, endpoint o refactor significativo), ejecutar la siguiente checklist **en orden**. No marcar el feature como completo si algún punto falla.

### 1. Tests pasan sin errores

```bash
pnpm test                  # 0 fallos en unit tests
pnpm test:e2e              # 0 fallos — E2E son OBLIGATORIOS para todo feature nuevo con endpoints HTTP
```

### 2. Cobertura no regresa

```bash
pnpm test:cov              # Statements ≥ 70% global; use cases ≥ 90%
```

### 3. Lint sin errores ni warnings bloqueantes

```bash
pnpm lint                  # 0 errors; warnings solo en casos justificados
```

### 4. TypeScript compila limpio

```bash
pnpm tsc --noEmit          # 0 errores de tipo
```

### 5. Revisión de bugs

Verificar manualmente que:
- Todos los casos de error del use case están cubiertos por tests
- Los DTOs validan todos los campos de entrada (`class-validator`)
- No hay rutas que omitan el `JwtAuthGuard` sin `@Public()` explícito
- Los errores de dominio están mapeados en `DOMAIN_HTTP_MAP`

### 6. Deuda técnica

Buscar y evaluar los `// TODO` introducidos en el feature:
- Si es deuda aceptable (requiere un módulo futuro), documentar en el comentario con la fase correspondiente: `// TODO (Fase 4): ...`
- Si es un bug latente o workaround temporal, crear una tarea antes de continuar

### 7. Actualizar el plan

Marcar los ítems completados en [docs/implementation-plan.md](docs/implementation-plan.md).

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

---

## Convención de documentación (obligatoria)

Todo cambio con impacto de **contrato público** o **arquitectura** debe documentarse **antes** de empezar y **después** de shipear. Sin excepción. Esta convención complementa la checklist de auditoría de arriba — la auditoría valida código, esto valida docs.

### Antes de codear

Si el PR introduce un endpoint, módulo, variable de entorno, comando de `package.json`, DTO nuevo, o código de error:

1. **Escribir o actualizar el doc primero** con la shape planeada. El diff del doc sirve como "spec" al que codear.
2. Archivos candidatos (no todos aplican a cada cambio):
   - [`docs/frontend/api-reference.md`](docs/frontend/api-reference.md) si el cambio toca la API expuesta al frontend
   - [`docs/frontend/error-codes.md`](docs/frontend/error-codes.md) si hay códigos nuevos
   - [`docs/frontend/enums.md`](docs/frontend/enums.md) si hay enums nuevos
   - [`docs/api-conventions.md`](docs/api-conventions.md) si cambia el patrón de request/response (ApiResponse wrapper, paginación, etc.)
   - [`docs/architecture.md`](docs/architecture.md) si cambia la estructura de capas o dependencias entre módulos
   - [`docs/business-model.md`](docs/business-model.md) si cambia una regla de negocio o se agrega una entidad de dominio
   - [`docs/implementation-plan.md`](docs/implementation-plan.md) si es una fase nueva o cambia el alcance de una existente
   - `README.md` si cambian comandos, env vars, prereqs o estructura de carpetas
   - `.env.example` si se agrega una variable obligatoria

### Después de shipear (checklist del PR)

- [ ] `api-reference.md` refleja la shape final si difiere de la planeada
- [ ] `error-codes.md` incluye cualquier código de error nuevo + está mapeado en `DOMAIN_HTTP_MAP` + agregado a `ERROR_CODES` en `src/common/errors/error-codes.ts`
- [ ] `enums.md` refleja los enums nuevos
- [ ] `implementation-plan.md` marca la fase con ✅ si quedó completa, o actualiza su avance
- [ ] `README.md` actualizado si cambiaron comandos, env vars, módulos listados o estructura
- [ ] `.env.example` refleja variables nuevas
- [ ] Swagger registrado correctamente en los controllers (`@ApiTags`, `@ApiOperation`, `@ApiResponse` con códigos y descripciones)
- [ ] Los TODOs introducidos en código tienen tag de fase: `// TODO (Fase X): ...`

### Excepciones (no requieren doc)

- Fixes puntuales sin cambio de contrato
- Tests puros (nuevos specs sobre código existente)
- Refactors internos que preservan la API pública
- Dependencias menores sin impacto en el cliente

> **Regla de dedo:** si dudás si documentar o no, **documentar igual**. Es más barato bajar una doc innecesaria que subir una que falta.

> **Sincronización entre repos:** `docs/frontend/api-reference.md`, `docs/frontend/error-codes.md` y `docs/frontend/enums.md` están duplicados con `habit-sumaq-web/docs/frontend/*`. Mantenerlos en sync al modificar — o proponer al usuario unificarlos en algún momento.
