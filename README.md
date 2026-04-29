# Habit Sumaq — Backend v2

API REST para gestión personal de finanzas y hábitos. Construida con NestJS 11, TypeScript strict, PostgreSQL, Redis y Google OAuth 2.0.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 |
| Lenguaje | TypeScript 5.7 (strict) |
| ORM | TypeORM + PostgreSQL 17 |
| Cache / sesiones | Redis 7 (ioredis) |
| Autenticación | Google OAuth 2.0 + JWT |
| Documentación | Swagger (OpenAPI 3) |
| Testing | Jest + Supertest |
| Logging | Pino |

## Prerequisitos

- Node.js >= 22
- pnpm >= 9
- Docker + Docker Compose

## Setup local

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env` y completar los valores obligatorios:

| Variable | Descripción |
|---|---|
| `JWT_ACCESS_SECRET` | Mínimo 32 caracteres aleatorios |
| `JWT_REFRESH_SECRET` | Mínimo 32 caracteres, diferente al anterior |
| `GOOGLE_CLIENT_ID` | Obtener en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Idem |

En Google Cloud Console, agregar como URI de redirección autorizada:
`http://localhost:3010/api/v1/auth/google/callback`

### 3. Levantar infraestructura (PostgreSQL + Redis)

```bash
docker compose up -d
```

Verifica que los contenedores estén healthy:

```bash
docker compose ps
```

### 4. Ejecutar migraciones

```bash
pnpm migration:run
```

### 5. Iniciar servidor de desarrollo

```bash
pnpm start:dev
```

El servidor queda disponible en `http://localhost:3010`.

## Documentación de la API

- Swagger UI: `http://localhost:3010/docs`
- OpenAPI JSON: `http://localhost:3010/docs-json`

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | /api/v1/health | - | Estado del servicio |
| GET | /api/v1/auth/google | - | Iniciar OAuth con Google |
| GET | /api/v1/auth/google/callback | - | Callback OAuth |
| POST | /api/v1/auth/refresh | Cookie | Rotar access token |
| POST | /api/v1/auth/logout | Bearer | Cerrar sesión |
| GET | /api/v1/auth/me | Bearer | Perfil del usuario |
| POST | /api/v1/accounts | Bearer | Crear cuenta |
| GET | /api/v1/accounts | Bearer | Listar cuentas |
| GET | /api/v1/accounts/:id | Bearer | Obtener cuenta |
| PATCH | /api/v1/accounts/:id | Bearer | Actualizar cuenta |
| PATCH | /api/v1/accounts/:id/archive | Bearer | Archivar cuenta |
| DELETE | /api/v1/accounts/:id | Bearer | Eliminar cuenta |
| GET | /api/v1/monthly-services | Bearer | Listar servicios mensuales |
| GET | /api/v1/monthly-services/:id | Bearer | Obtener servicio mensual |
| POST | /api/v1/monthly-services | Bearer | Crear servicio mensual |
| PATCH | /api/v1/monthly-services/:id | Bearer | Editar servicio mensual |
| POST | /api/v1/monthly-services/:id/pay | Bearer | Registrar pago del mes |
| POST | /api/v1/monthly-services/:id/skip | Bearer | Saltear el mes sin pagar |
| PATCH | /api/v1/monthly-services/:id/archive | Bearer | Archivar/desarchivar |
| DELETE | /api/v1/monthly-services/:id | Bearer | Eliminar (solo sin pagos) |
| GET | /api/v1/chores | Bearer | Listar tareas recurrentes |
| GET | /api/v1/chores/:id | Bearer | Obtener una tarea |
| GET | /api/v1/chores/:id/logs | Bearer | Listar eventos paginados de una tarea |
| POST | /api/v1/chores | Bearer | Crear una tarea recurrente |
| PATCH | /api/v1/chores/:id | Bearer | Editar una tarea |
| POST | /api/v1/chores/:id/done | Bearer | Marcar como hecha (crea log + avanza nextDueDate) |
| POST | /api/v1/chores/:id/skip | Bearer | Saltear un ciclo sin marcar como hecha |
| PATCH | /api/v1/chores/:id/archive | Bearer | Archivar/desarchivar |
| DELETE | /api/v1/chores/:id | Bearer | Eliminar (solo sin logs) |

## Comandos frecuentes

```bash
pnpm start:dev                                          # Desarrollo
pnpm build                                              # Compilar
pnpm lint                                               # Lint
pnpm test                                               # Tests unitarios
pnpm test:e2e                                           # Tests e2e
pnpm test:cov                                           # Cobertura
pnpm migration:generate src/database/migrations/<Nombre>  # Generar migración
pnpm migration:run                                      # Correr migraciones
pnpm migration:revert                                   # Revertir última migración
```

## Arquitectura

El proyecto sigue Clean Architecture por módulo:

```
src/modules/<feature>/
  domain/          # Entidades puras, repositorios (interfaces), value objects
  application/     # Use cases, DTOs
  infrastructure/  # ORM entities, implementaciones de repositorios
  presentation/    # Controllers, módulo NestJS
```

Ver docs/architecture.md para detalles completos.

## Convenciones clave

- Código en inglés; mensajes de dominio y Swagger en español
- Todos los endpoints retornan ApiResponse<T>
- Soft delete con @DeleteDateColumn() — nunca DELETE físico en entidades de dominio
- Refresh tokens en Redis (TTL automático), nunca en texto plano
- Errores de dominio con códigos hasheados (SHA-256) para no exponer internos
