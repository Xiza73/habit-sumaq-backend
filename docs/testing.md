# Estrategia de Testing — Habit Sumaq v2

## Filosofía

> Testear comportamiento, no implementación.

- Los tests verifican **qué hace** el código, no **cómo lo hace**.
- Un test que falla al refactorizar internos sin cambiar comportamiento es un test mal escrito.
- Preferir pocos tests de alto valor que muchos tests frágiles.

---

## Pirámide de tests

```
        /\
       /e2e\          ← Pocos, lentos, validan flujos completos
      /------\
     / integr \       ← Medianos, validan módulos con BD real
    /----------\
   / unit tests \     ← Muchos, rápidos, sin IO externo
  /--------------\
```

| Tipo | Qué testea | Herramienta | Base de datos |
|---|---|---|---|
| Unit | Use cases, domain logic | Jest | Mock (in-memory) |
| Integration | Repositorios | Jest + TypeORM | PostgreSQL test |
| e2e | Endpoints HTTP | Jest + Supertest | PostgreSQL test |

---

## Tests unitarios

### Qué testear

- **Use cases**: toda la lógica de negocio.
- **Domain entities**: métodos de dominio (`credit()`, `debit()`, invariantes).
- **Value objects**: validaciones, igualdad.

### Qué NO testear con unit tests

- Controllers (solo orquestan, poco valor)
- Repositories (testar con integration tests)
- Config / bootstrap

### Convenciones

```typescript
// Archivo: create-account.use-case.spec.ts
// Ubicación: al lado del archivo que testea

describe('CreateAccountUseCase', () => {
  let useCase: CreateAccountUseCase;
  let mockRepo: jest.Mocked<AccountRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new CreateAccountUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should create account with initial balance of 0 when not provided', async () => {
      mockRepo.findByUserId.mockResolvedValue([]);
      mockRepo.save.mockImplementation(async (a) => a);

      const result = await useCase.execute('user-1', {
        name: 'Mi cuenta',
        type: AccountType.CHECKING,
        currency: Currency.PEN,
      });

      expect(result.balance).toBe(0);
      expect(mockRepo.save).toHaveBeenCalledOnce();
    });

    it('should throw DomainException when account name already exists for user', async () => {
      const existing = buildAccount({ userId: 'user-1', name: 'Mi cuenta' });
      mockRepo.findByUserId.mockResolvedValue([existing]);

      await expect(
        useCase.execute('user-1', { name: 'Mi cuenta', type: AccountType.CHECKING, currency: Currency.PEN }),
      ).rejects.toThrow(DomainException);
    });
  });
});
```

### Helpers de test

Crear factories para construir objetos de dominio en tests:

```typescript
// src/modules/accounts/domain/__tests__/account.factory.ts
export function buildAccount(overrides: Partial<Account> = {}): Account {
  return new Account(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test',
    overrides.name ?? 'Test Account',
    overrides.type ?? AccountType.CHECKING,
    overrides.currency ?? Currency.PEN,
    overrides.balance ?? 0,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.deletedAt ?? null,
  );
}
```

---

## Tests de integración (repositorios)

Testean la implementación del repositorio contra una base de datos PostgreSQL real.

```typescript
// src/modules/accounts/infrastructure/persistence/account.repository.impl.spec.ts
describe('AccountRepositoryImpl (integration)', () => {
  let repo: AccountRepositoryImpl;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource(); // DB de test
    repo = new AccountRepositoryImpl(dataSource.getRepository(AccountOrmEntity));
  });

  afterEach(async () => {
    await dataSource.getRepository(AccountOrmEntity).clear();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('should persist and retrieve an account', async () => {
    const account = buildAccount({ userId: 'user-1' });
    await repo.save(account);

    const found = await repo.findById(account.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(account.name);
  });
});
```

### Base de datos de test

Usar una base de datos separada para tests: `habit_sumaq_test`.

```typescript
// src/database/test-data-source.ts
export function createTestDataSource(): Promise<DataSource> {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME_TEST ?? 'habit_sumaq_test',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    synchronize: true,   // Solo en tests, nunca en producción
    entities: [AccountOrmEntity, UserOrmEntity, RefreshTokenOrmEntity],
    dropSchema: false,
  }).initialize();
}
```

---

## Tests e2e

Testean el flujo HTTP completo: request → controller → use case → repositorio → DB → response.

> **Requerimiento**: todo módulo nuevo que exponga endpoints HTTP debe incluir un archivo `test/<feature>.e2e-spec.ts` que cubra happy path + errores principales de cada endpoint.

### Endpoint de test para Playwright — `POST /auth/test-login`

Para que la suite e2e del frontend (Playwright) pueda autenticarse sin pasar
por el flujo OAuth real de Google, existe el endpoint `POST /api/v1/auth/test-login`.
Emite un JWT válido para un usuario `test-<email>` y setea la cookie
`refresh_token` como HttpOnly igual que el login normal.

**Triple guarda — cualquier fallo devuelve 404:**

1. `NODE_ENV !== 'production'`.
2. `TEST_AUTH_ENABLED=true`.
3. Header `x-test-auth-secret` coincide con `TEST_AUTH_SECRET` (≥ 32 chars).

Habilitar en local o CI antes de correr Playwright:

```bash
TEST_AUTH_ENABLED=true TEST_AUTH_SECRET=<32-o-mas-chars> pnpm start:dev
```

El boot falla con un error de Zod `.superRefine` si:
- `TEST_AUTH_ENABLED=true` y `TEST_AUTH_SECRET` está ausente o tiene menos de 32 chars.
- `TEST_AUTH_ENABLED=true` y `NODE_ENV=production` (guarda defensiva redundante).

Ver [`api-conventions.md`](api-conventions.md#post-apiv1authtest-login-testing-only)
para más detalle del contrato.

---


```typescript
// test/accounts.e2e-spec.ts
describe('/accounts (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    applyGlobalMiddleware(app); // ValidationPipe, filtros, etc.
    await app.init();

    // Crear usuario y obtener token para los tests
    accessToken = await getTestAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /accounts', () => {
    it('should create account and return 201', () => {
      return request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Cuenta BCP', type: 'checking', currency: 'PEN' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe('Cuenta BCP');
          expect(body.data.balance).toBe(0);
        });
    });

    it('should return 400 when name is missing', () => {
      return request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type: 'checking', currency: 'PEN' })
        .expect(400);
    });

    it('should return 401 when no token', () => {
      return request(app.getHttpServer())
        .post('/accounts')
        .send({ name: 'Test', type: 'checking', currency: 'PEN' })
        .expect(401);
    });
  });

  describe('GET /accounts', () => {
    it('should return only accounts of authenticated user', async () => {
      // Crear cuenta con usuario 1
      await createTestAccount(app, accessToken, 'Cuenta 1');

      // Crear usuario 2 con su propio token
      const otherToken = await getTestAccessToken(app, 'other@test.com');
      await createTestAccount(app, otherToken, 'Cuenta del otro');

      // Usuario 1 solo debe ver su cuenta
      const { body } = await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Cuenta 1');
    });
  });
});
```

---

## Estructura de archivos de test

```
src/
  modules/
    accounts/
      domain/
        account.entity.spec.ts           # Unit: métodos de dominio
        __tests__/
          account.factory.ts             # Factory helper
      application/
        use-cases/
          create-account.use-case.spec.ts
          get-accounts.use-case.spec.ts
          ...
      infrastructure/
        persistence/
          account.repository.impl.spec.ts # Integration
test/
  accounts.e2e-spec.ts
  auth.e2e-spec.ts
  helpers/
    auth.helper.ts       # getTestAccessToken()
    db.helper.ts         # Limpiar tablas entre tests
```

---

## Configuración de Jest

```javascript
// jest.config.js (actualizar para soportar path aliases)
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
};
```

---

## Objetivos de cobertura

| Capa | Cobertura objetivo |
|---|---|
| Domain entities | 100% (son lógica pura) |
| Use cases | 90%+ |
| Repositorios | 80%+ (via integration tests) |
| Controllers | No se testean unitariamente |
| Global coverage | 75%+ |

---

## CI (futuro)

Cuando se configure CI (GitHub Actions):

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: pnpm test

- name: Run e2e tests
  run: pnpm test:e2e
  env:
    DB_NAME_TEST: habit_sumaq_test
    # ... resto de env vars

- name: Check coverage
  run: pnpm test:cov --coverageThreshold='{"global":{"lines":75}}'
```
