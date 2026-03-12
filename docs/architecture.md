# Arquitectura — Habit Sumaq v2

## Principio fundamental

**Clean Architecture adaptada a NestJS.** La lógica de dominio no conoce frameworks, ORM, ni HTTP. Los detalles (TypeORM, Express, Google OAuth) dependen del dominio, nunca al revés.

```
[Presentation] → [Application] → [Domain] ← [Infrastructure]
```

- `Domain`: entidades, value objects, interfaces de repositorio. **Cero dependencias externas.**
- `Application`: use cases, DTOs, orquestación. Depende solo de `Domain`.
- `Infrastructure`: implementaciones concretas (TypeORM, OAuth). Depende de `Domain`.
- `Presentation`: controllers, guards HTTP. Depende de `Application`.

---

## Estructura de directorios

```
src/
├── main.ts                        # Bootstrap de la app
├── app.module.ts                  # Módulo raíz
│
├── config/                        # Configuración centralizada
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── google-oauth.config.ts
│
├── database/                      # Setup de TypeORM
│   ├── data-source.ts             # DataSource para migraciones CLI
│   └── migrations/                # Archivos de migración generados
│
├── common/                        # Utilidades transversales
│   ├── dto/
│   │   └── api-response.dto.ts    # Wrapper ApiResponse<T>
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   ├── interceptors/
│   │   └── response-transform.interceptor.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   └── pipes/
│       └── parse-uuid.pipe.ts
│
├── modules/
│   ├── auth/                      # Autenticación Google + JWT
│   │   ├── domain/
│   │   │   └── token.entity.ts    # Refresh token
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── google-login.use-case.ts
│   │   │   │   └── refresh-token.use-case.ts
│   │   │   └── dto/
│   │   │       └── auth-response.dto.ts
│   │   ├── infrastructure/
│   │   │   ├── strategies/
│   │   │   │   ├── google.strategy.ts
│   │   │   │   ├── jwt-access.strategy.ts
│   │   │   │   └── jwt-refresh.strategy.ts
│   │   │   └── persistence/
│   │   │       └── refresh-token.orm-entity.ts
│   │   └── presentation/
│   │       ├── auth.controller.ts
│   │       └── auth.module.ts
│   │
│   ├── users/                     # Gestión de usuarios
│   │   ├── domain/
│   │   │   ├── user.entity.ts
│   │   │   └── user.repository.ts  # Abstract class (interfaz)
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── find-or-create-user.use-case.ts
│   │   │   │   └── get-user-profile.use-case.ts
│   │   │   └── dto/
│   │   │       └── user-response.dto.ts
│   │   ├── infrastructure/
│   │   │   └── persistence/
│   │   │       ├── user.orm-entity.ts
│   │   │       └── user.repository.impl.ts
│   │   └── presentation/
│   │       ├── users.controller.ts
│   │       └── users.module.ts
│   │
│   └── accounts/                  # Cuentas financieras (primer módulo de negocio)
│       ├── domain/
│       │   ├── account.entity.ts
│       │   ├── account.repository.ts
│       │   └── value-objects/
│       │       ├── money.vo.ts
│       │       └── account-type.vo.ts
│       ├── application/
│       │   ├── use-cases/
│       │   │   ├── create-account.use-case.ts
│       │   │   ├── get-accounts.use-case.ts
│       │   │   ├── get-account-by-id.use-case.ts
│       │   │   ├── update-account.use-case.ts
│       │   │   └── delete-account.use-case.ts
│       │   └── dto/
│       │       ├── create-account.dto.ts
│       │       ├── update-account.dto.ts
│       │       └── account-response.dto.ts
│       ├── infrastructure/
│       │   └── persistence/
│       │       ├── account.orm-entity.ts
│       │       └── account.repository.impl.ts
│       └── presentation/
│           ├── accounts.controller.ts
│           └── accounts.module.ts
```

---

## Capa de Dominio

### Entidades de dominio

Las entidades de dominio son clases TypeScript puras. **No tienen decoradores de TypeORM.**

```typescript
// src/modules/accounts/domain/account.entity.ts
export class Account {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public name: string,
    public type: AccountType,
    public currency: Currency,
    public balance: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  credit(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.balance += amount;
    this.updatedAt = new Date();
  }

  debit(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.balance -= amount;
    this.updatedAt = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
```

### Repositorios (interfaces)

Se definen como `abstract class` para poder inyectarlos con el DI de NestJS.

```typescript
// src/modules/accounts/domain/account.repository.ts
export abstract class AccountRepository {
  abstract findById(id: string): Promise<Account | null>;
  abstract findByUserId(userId: string): Promise<Account[]>;
  abstract save(account: Account): Promise<Account>;
  abstract softDelete(id: string): Promise<void>;
}
```

### Value Objects

Encapsulan reglas de validación de valores del dominio.

```typescript
// src/modules/accounts/domain/value-objects/account-type.vo.ts
export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  INVESTMENT = 'investment',
}

export enum Currency {
  PEN = 'PEN',
  USD = 'USD',
  EUR = 'EUR',
}
```

---

## Capa de Aplicación

### Use Cases

Cada use case es una clase con un único método `execute()`. Recibe DTOs, orquesta el dominio, retorna DTOs.

```typescript
// src/modules/accounts/application/use-cases/create-account.use-case.ts
@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(userId: string, dto: CreateAccountDto): Promise<AccountResponseDto> {
    const account = new Account(
      randomUUID(),
      userId,
      dto.name,
      dto.type,
      dto.currency,
      dto.initialBalance ?? 0,
      new Date(),
      new Date(),
      null,
    );
    const saved = await this.accountRepository.save(account);
    return AccountResponseDto.fromDomain(saved);
  }
}
```

### DTOs

- **Request DTOs**: tienen decoradores `class-validator` y `@ApiProperty`.
- **Response DTOs**: tienen método estático `fromDomain()` para mapear desde entidad.

---

## Capa de Infraestructura

### ORM Entities

Las entidades TypeORM son separadas de las entidades de dominio. Se mapean entre sí en el repositorio.

```typescript
// src/modules/accounts/infrastructure/persistence/account.orm-entity.ts
@Entity('accounts')
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
```

### Implementaciones de Repositorio

```typescript
// src/modules/accounts/infrastructure/persistence/account.repository.impl.ts
@Injectable()
export class AccountRepositoryImpl extends AccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly repo: Repository<AccountOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<Account | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  private toDomain(orm: AccountOrmEntity): Account {
    return new Account(
      orm.id, orm.userId, orm.name, orm.type,
      orm.currency, Number(orm.balance), orm.createdAt,
      orm.updatedAt, orm.deletedAt,
    );
  }

  private toOrm(domain: Account): AccountOrmEntity {
    const entity = new AccountOrmEntity();
    Object.assign(entity, domain);
    return entity;
  }
}
```

---

## Capa de Presentación

### Controllers

Solo orquestación HTTP: extraer datos del request, llamar al use case, retornar la respuesta.

```typescript
@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly createAccount: CreateAccountUseCase,
    private readonly getAccounts: GetAccountsUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una cuenta financiera' })
  @ApiResponse({ status: 201, type: AccountResponseDto })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.createAccount.execute(user.sub, dto);
  }
}
```

---

## Módulo canónico (providers)

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([AccountOrmEntity])],
  controllers: [AccountsController],
  providers: [
    // Use cases
    CreateAccountUseCase,
    GetAccountsUseCase,
    GetAccountByIdUseCase,
    UpdateAccountUseCase,
    DeleteAccountUseCase,
    // Repositorio: bind interfaz → implementación
    { provide: AccountRepository, useClass: AccountRepositoryImpl },
  ],
  exports: [GetAccountByIdUseCase], // Solo exportar lo que otros módulos necesiten
})
export class AccountsModule {}
```

---

## Respuesta unificada

Todo endpoint retorna `ApiResponse<T>` vía un interceptor global.

```typescript
// src/common/dto/api-response.dto.ts
export class ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  error?: { code: string; details?: unknown }; // code = identificador opaco (ej. "ACC_001")
  meta?: { page: number; limit: number; total: number };
}
```

El `ResponseTransformInterceptor` envuelve automáticamente cualquier valor retornado por un controller. Los errores los maneja `AllExceptionsFilter`.

---

## Base de datos

### Regla de oro: sin `synchronize`

```typescript
// src/database/data-source.ts
export const AppDataSource = new DataSource({
  type: 'postgres',
  synchronize: false,          // SIEMPRE false
  migrationsRun: true,         // Corre migraciones al iniciar en producción
  entities: [...],
  migrations: ['dist/database/migrations/*.js'],
});
```

### Workflow de migración

```bash
# 1. Modificar la ORM entity
# 2. Generar
pnpm typeorm migration:generate src/database/migrations/AddAccountType

# 3. Revisar el archivo generado
# 4. Aplicar
pnpm typeorm migration:run
```

---

## Autenticación

Flujo completo:

```
1. GET /auth/google         → Redirect a Google
2. GET /auth/google/callback → Google llama con code
3. GoogleStrategy valida    → find-or-create user en DB
4. Genera access_token (15min) + refresh_token (7d, httpOnly cookie)
5. Redirect al frontend con access_token en query param
6. POST /auth/refresh       → Lee cookie, valida refresh, emite nuevo access_token
7. POST /auth/logout        → Invalida refresh_token en DB + limpia cookie
```

Todo endpoint protegido usa `@UseGuards(JwtAuthGuard)`. Para endpoints públicos: `@Public()`.
