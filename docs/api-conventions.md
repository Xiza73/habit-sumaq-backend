# Convenciones de API — Habit Sumaq v2

## Principios generales

- **REST semántico**: los recursos son sustantivos en plural (`/accounts`, `/users`).
- **Sin side effects en GET**: nunca modificar estado en un endpoint de lectura.
- **HTTP status codes correctos**: no usar siempre 200, usar el código apropiado.
- **Respuesta unificada**: siempre `ApiResponse<T>`, sin excepciones.

---

## Respuesta unificada

Todos los endpoints retornan esta estructura:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  error?: {
    code: string;       // Código de error del dominio: "ACCOUNT_NOT_FOUND"
    details?: unknown;  // Detalles adicionales (errores de validación, etc.)
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Respuesta exitosa

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Cuenta BCP",
    "type": "checking",
    "currency": "PEN",
    "balance": 1500.00,
    "color": "#4CAF50",
    "isArchived": false,
    "createdAt": "2026-03-11T10:00:00.000Z"
  },
  "message": "Cuenta creada exitosamente"
}
```

### Respuesta de error

```json
{
  "success": false,
  "data": null,
  "message": "La cuenta no existe",
  "error": {
    "code": "ACCOUNT_NOT_FOUND"
  }
}
```

### Respuesta paginada

```json
{
  "success": true,
  "data": [...],
  "message": "Cuentas obtenidas exitosamente",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## HTTP Status Codes

| Situación | Status |
|---|---|
| Creación exitosa | `201 Created` |
| Lectura/Update/Delete exitoso | `200 OK` |
| Sin contenido (ej. logout) | `204 No Content` |
| Error de validación (input inválido) | `400 Bad Request` |
| No autenticado | `401 Unauthorized` |
| Autenticado pero sin permiso | `403 Forbidden` |
| Recurso no encontrado | `404 Not Found` |
| Conflicto de estado (ej. nombre duplicado) | `409 Conflict` |
| Error interno del servidor | `500 Internal Server Error` |

---

## Rutas y naming

### Patrón base

```
/api/v1/<recurso>
/api/v1/<recurso>/:id
/api/v1/<recurso>/:id/<sub-recurso>
```

El prefijo `/api/v1` se configura globalmente en `main.ts`:
```typescript
app.setGlobalPrefix('api/v1');
```

### Convenciones de rutas

- **Recursos en plural**: `/accounts`, no `/account`
- **kebab-case** para recursos compuestos: `/daily-planners`, `/refresh-tokens`
- **Sub-recursos** para acciones que no son CRUD puro:
  ```
  PATCH /accounts/:id/archive     → Archivar cuenta
  POST  /auth/refresh             → Rotar token
  POST  /auth/logout              → Cerrar sesión
  ```
- **Query params** para filtros y paginación, no path params:
  ```
  GET /accounts?includeArchived=true&currency=USD
  GET /accounts?page=2&limit=10
  ```

### Acciones que no son CRUD

Usar verbos como sub-ruta cuando una acción no encaja en CRUD:

```
PATCH /accounts/:id/archive     ✓ (no es update genérico, es una acción específica)
DELETE /accounts/:id            ✓ (soft delete)
POST /auth/logout               ✓ (acción, no creación de recurso)
POST /auth/refresh              ✓ (acción)
```

---

## Endpoints del proyecto

### Auth

```
GET  /api/v1/auth/google           → Inicia OAuth con Google (público)
GET  /api/v1/auth/google/callback  → Callback OAuth (público)
POST /api/v1/auth/refresh          → Rota access token (refresh en cookie)
POST /api/v1/auth/logout           → Revoca refresh token
GET  /api/v1/auth/me               → Perfil del usuario autenticado
```

### Users

```
GET   /api/v1/users/profile        → Perfil completo (alias de /auth/me)
PATCH /api/v1/users/profile        → Actualizar nombre/avatar
```

### Accounts

```
POST   /api/v1/accounts               → Crear cuenta
GET    /api/v1/accounts               → Listar cuentas del usuario
GET    /api/v1/accounts/:id           → Obtener cuenta por ID
PATCH  /api/v1/accounts/:id           → Actualizar nombre/color/icono
PATCH  /api/v1/accounts/:id/archive   → Archivar/desarchivar cuenta
DELETE /api/v1/accounts/:id           → Soft delete
```

---

## DTOs

### Request DTOs

```typescript
// create-account.dto.ts
export class CreateAccountDto {
  @ApiProperty({ example: 'Cuenta BCP', description: 'Nombre de la cuenta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.CHECKING })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ enum: Currency, example: Currency.PEN })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({ example: 0, description: 'Saldo inicial' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({ example: '#4CAF50' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'wallet' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}
```

### Response DTOs

```typescript
// account-response.dto.ts
export class AccountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AccountType })
  type: AccountType;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  balance: number;

  @ApiProperty({ nullable: true })
  color: string | null;

  @ApiProperty({ nullable: true })
  icon: string | null;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(account: Account): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.name = account.name;
    dto.type = account.type;
    dto.currency = account.currency;
    dto.balance = account.balance;
    dto.color = account.color;
    dto.icon = account.icon;
    dto.isArchived = account.isArchived;
    dto.createdAt = account.createdAt;
    dto.updatedAt = account.updatedAt;
    return dto;
  }
}
```

---

## Paginación

Query params estándar para todos los endpoints de lista:

```
GET /api/v1/accounts?page=1&limit=20
```

- `page`: número de página, base 1 (default: 1)
- `limit`: items por página (default: 20, máximo: 100)

DTO reutilizable:

```typescript
// src/common/dto/pagination.dto.ts
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```

---

## Manejo de errores de dominio

Los `DomainError` se mapean a HTTP responses en el `AllExceptionsFilter`:

```typescript
const DOMAIN_ERROR_MAP: Record<string, number> = {
  ACCOUNT_NOT_FOUND: 404,
  ACCOUNT_NAME_TAKEN: 409,
  ACCOUNT_HAS_ACTIVE_TRANSACTIONS: 409,
  ACCOUNT_BELONGS_TO_OTHER_USER: 403,
  CANNOT_CHANGE_CURRENCY_WITH_TRANSACTIONS: 409,
  USER_NOT_FOUND: 404,
  USER_INACTIVE: 403,
  INVALID_REFRESH_TOKEN: 401,
};
```

Ejemplo de error en use case:

```typescript
const existing = await this.repo.findByUserId(userId);
const nameTaken = existing.some(a => a.name === dto.name);
if (nameTaken) {
  throw new DomainError('ACCOUNT_NAME_TAKEN', 'Ya existe una cuenta con ese nombre');
}
```

---

## Documentación Swagger

Cada controller y endpoint **debe** tener:

```typescript
@ApiTags('Accounts')                    // Agrupa en Swagger UI
@ApiBearerAuth()                        // Indica que requiere JWT
@Controller('accounts')
export class AccountsController {

  @Post()
  @ApiOperation({ summary: 'Crear una cuenta financiera' })
  @ApiResponse({ status: 201, description: 'Cuenta creada', type: AccountResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Nombre de cuenta ya existe' })
  create(...) {}
}
```

Swagger disponible en: `GET /docs`
JSON spec en: `GET /docs-json`
