/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AppDataSource } from '../data-source';

/**
 * Seed script: llena la BD con datos de prueba.
 * Condiciones:
 *   - Solo se hará el seed a un usuario.
 *   - Ese usuario no debe tener ninguna cuenta.
 *
 * Uso: pnpm migration:seed
 */
async function seed() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    const users = await queryRunner.query(
      `SELECT id FROM users WHERE email = 'gvnner73@gmail.com' AND "deletedAt" IS NULL`,
    );

    const userId: string = users[0]?.id;

    const accounts = await queryRunner.query(
      `SELECT id FROM accounts WHERE "userId" = $1 AND "deletedAt" IS NULL`,
      [userId],
    );

    if (accounts.length > 0) {
      console.error(`❌ El usuario ya tiene ${accounts.length} cuenta(s). Abortando seed.`);
      process.exit(1);
    }

    await queryRunner.startTransaction();

    // ── User Settings ─────────────────────────────────────────────
    const existingSettings = await queryRunner.query(
      `SELECT id FROM user_settings WHERE "userId" = $1`,
      [userId],
    );

    if (existingSettings.length === 0) {
      await queryRunner.query(
        `INSERT INTO user_settings (id, "userId", language, theme, "defaultCurrency", "dateFormat", "startOfWeek")
         VALUES (gen_random_uuid(), $1, 'es', 'system', 'PEN', 'DD/MM/YYYY', 'monday')`,
        [userId],
      );
      console.log('✅ User settings creados');
    }

    // ── Cuentas ───────────────────────────────────────────────────
    const accountsData = [
      {
        name: 'Cuenta Principal',
        type: 'checking',
        currency: 'PEN',
        balance: 3500.0,
        color: '#4F46E5',
        icon: 'bank',
      },
      {
        name: 'Ahorro Emergencia',
        type: 'savings',
        currency: 'PEN',
        balance: 8000.0,
        color: '#10B981',
        icon: 'piggy-bank',
      },
      {
        name: 'Efectivo',
        type: 'cash',
        currency: 'PEN',
        balance: 250.0,
        color: '#F59E0B',
        icon: 'cash',
      },
      {
        name: 'Tarjeta de Crédito',
        type: 'credit_card',
        currency: 'PEN',
        balance: -1200.0,
        color: '#EF4444',
        icon: 'credit-card',
      },
      {
        name: 'Cuenta USD',
        type: 'savings',
        currency: 'USD',
        balance: 500.0,
        color: '#3B82F6',
        icon: 'dollar',
      },
    ];

    const insertedAccounts: { name: string; id: string }[] = [];

    for (const acc of accountsData) {
      const result = await queryRunner.query(
        `INSERT INTO accounts (id, "userId", name, type, currency, balance, color, icon)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [userId, acc.name, acc.type, acc.currency, acc.balance, acc.color, acc.icon],
      );
      insertedAccounts.push({ name: acc.name, id: result[0].id });
    }

    console.log(`✅ ${insertedAccounts.length} cuentas creadas`);

    const accountMap = Object.fromEntries(insertedAccounts.map((a) => [a.name, a.id]));

    // ── Categorías ────────────────────────────────────────────────
    const categoriesData = [
      // Ingresos
      { name: 'Salario', type: 'INCOME', color: '#10B981', icon: 'briefcase' },
      { name: 'Freelance', type: 'INCOME', color: '#6366F1', icon: 'laptop' },
      { name: 'Inversiones', type: 'INCOME', color: '#8B5CF6', icon: 'trending-up' },
      { name: 'Regalos Recibidos', type: 'INCOME', color: '#EC4899', icon: 'gift' },
      // Gastos
      { name: 'Alimentación', type: 'EXPENSE', color: '#F59E0B', icon: 'utensils' },
      { name: 'Transporte', type: 'EXPENSE', color: '#3B82F6', icon: 'car' },
      { name: 'Vivienda', type: 'EXPENSE', color: '#EF4444', icon: 'home' },
      { name: 'Servicios', type: 'EXPENSE', color: '#14B8A6', icon: 'zap' },
      { name: 'Entretenimiento', type: 'EXPENSE', color: '#A855F7', icon: 'film' },
      { name: 'Salud', type: 'EXPENSE', color: '#22C55E', icon: 'heart' },
      { name: 'Educación', type: 'EXPENSE', color: '#0EA5E9', icon: 'book' },
      { name: 'Ropa', type: 'EXPENSE', color: '#F43F5E', icon: 'shirt' },
      { name: 'Restaurantes', type: 'EXPENSE', color: '#FB923C', icon: 'coffee' },
      { name: 'Suscripciones', type: 'EXPENSE', color: '#64748B', icon: 'repeat' },
    ];

    const insertedCategories: { name: string; id: string }[] = [];

    for (const cat of categoriesData) {
      const result = await queryRunner.query(
        `INSERT INTO categories (id, "userId", name, type, color, icon, "isDefault")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)
         RETURNING id`,
        [userId, cat.name, cat.type, cat.color, cat.icon],
      );
      insertedCategories.push({ name: cat.name, id: result[0].id });
    }

    console.log(`✅ ${insertedCategories.length} categorías creadas`);

    const catMap = Object.fromEntries(insertedCategories.map((c) => [c.name, c.id]));

    // ── Transacciones ─────────────────────────────────────────────
    // Genera fechas relativas al momento actual (últimos 60 días)
    const daysAgo = (days: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString();
    };

    const transactionsData = [
      // ── Ingresos ──
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Salario',
        type: 'INCOME',
        amount: 5500.0,
        description: 'Sueldo mensual - Febrero',
        date: daysAgo(45),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Salario',
        type: 'INCOME',
        amount: 5500.0,
        description: 'Sueldo mensual - Marzo',
        date: daysAgo(15),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Freelance',
        type: 'INCOME',
        amount: 1200.0,
        description: 'Proyecto diseño web',
        date: daysAgo(30),
      },
      {
        accountName: 'Cuenta USD',
        categoryName: 'Freelance',
        type: 'INCOME',
        amount: 350.0,
        description: 'Consultoría externa',
        date: daysAgo(20),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Regalos Recibidos',
        type: 'INCOME',
        amount: 200.0,
        description: 'Regalo cumpleaños',
        date: daysAgo(10),
      },

      // ── Gastos ──
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Vivienda',
        type: 'EXPENSE',
        amount: 1800.0,
        description: 'Alquiler departamento',
        date: daysAgo(43),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Vivienda',
        type: 'EXPENSE',
        amount: 1800.0,
        description: 'Alquiler departamento',
        date: daysAgo(13),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Servicios',
        type: 'EXPENSE',
        amount: 120.0,
        description: 'Luz + Agua',
        date: daysAgo(40),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Servicios',
        type: 'EXPENSE',
        amount: 89.0,
        description: 'Internet Movistar',
        date: daysAgo(38),
      },
      {
        accountName: 'Tarjeta de Crédito',
        categoryName: 'Alimentación',
        type: 'EXPENSE',
        amount: 450.0,
        description: 'Supermercado Wong',
        date: daysAgo(35),
      },
      {
        accountName: 'Efectivo',
        categoryName: 'Alimentación',
        type: 'EXPENSE',
        amount: 85.0,
        description: 'Mercado semanal',
        date: daysAgo(28),
      },
      {
        accountName: 'Tarjeta de Crédito',
        categoryName: 'Alimentación',
        type: 'EXPENSE',
        amount: 380.0,
        description: 'Supermercado Plaza Vea',
        date: daysAgo(7),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Transporte',
        type: 'EXPENSE',
        amount: 150.0,
        description: 'Gasolina',
        date: daysAgo(25),
      },
      {
        accountName: 'Efectivo',
        categoryName: 'Transporte',
        type: 'EXPENSE',
        amount: 45.0,
        description: 'Taxi aeropuerto',
        date: daysAgo(18),
      },
      {
        accountName: 'Tarjeta de Crédito',
        categoryName: 'Entretenimiento',
        type: 'EXPENSE',
        amount: 60.0,
        description: 'Cine + Snacks',
        date: daysAgo(22),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Suscripciones',
        type: 'EXPENSE',
        amount: 45.0,
        description: 'Netflix + Spotify',
        date: daysAgo(12),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Salud',
        type: 'EXPENSE',
        amount: 200.0,
        description: 'Consulta médica',
        date: daysAgo(16),
      },
      {
        accountName: 'Efectivo',
        categoryName: 'Restaurantes',
        type: 'EXPENSE',
        amount: 95.0,
        description: 'Cena cumpleaños amigo',
        date: daysAgo(10),
      },
      {
        accountName: 'Tarjeta de Crédito',
        categoryName: 'Ropa',
        type: 'EXPENSE',
        amount: 310.0,
        description: 'Zapatillas Nike',
        date: daysAgo(5),
      },
      {
        accountName: 'Cuenta Principal',
        categoryName: 'Educación',
        type: 'EXPENSE',
        amount: 180.0,
        description: 'Curso Udemy x3',
        date: daysAgo(8),
      },
      {
        accountName: 'Efectivo',
        categoryName: 'Alimentación',
        type: 'EXPENSE',
        amount: 35.0,
        description: 'Panadería',
        date: daysAgo(2),
      },
      {
        accountName: 'Tarjeta de Crédito',
        categoryName: 'Restaurantes',
        type: 'EXPENSE',
        amount: 120.0,
        description: 'Almuerzo de trabajo',
        date: daysAgo(3),
      },
    ];

    let txCount = 0;

    for (const tx of transactionsData) {
      await queryRunner.query(
        `INSERT INTO transactions (id, "userId", "accountId", "categoryId", type, amount, description, date)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          accountMap[tx.accountName],
          catMap[tx.categoryName],
          tx.type,
          tx.amount,
          tx.description,
          tx.date,
        ],
      );
      txCount++;
    }

    // ── Transferencias ──
    const transfers = [
      {
        from: 'Cuenta Principal',
        to: 'Ahorro Emergencia',
        amount: 1000.0,
        description: 'Ahorro mensual - Febrero',
        date: daysAgo(42),
      },
      {
        from: 'Cuenta Principal',
        to: 'Ahorro Emergencia',
        amount: 1000.0,
        description: 'Ahorro mensual - Marzo',
        date: daysAgo(12),
      },
      {
        from: 'Cuenta Principal',
        to: 'Efectivo',
        amount: 300.0,
        description: 'Retiro cajero',
        date: daysAgo(30),
      },
    ];

    for (const tr of transfers) {
      await queryRunner.query(
        `INSERT INTO transactions (id, "userId", "accountId", "categoryId", type, amount, description, date, "destinationAccountId")
         VALUES (gen_random_uuid(), $1, $2, NULL, 'TRANSFER', $3, $4, $5, $6)`,
        [userId, accountMap[tr.from], tr.amount, tr.description, tr.date, accountMap[tr.to]],
      );
      txCount++;
    }

    // ── Deuda / Préstamo ──
    // Deuda: le debo a alguien
    const debtResult = await queryRunner.query(
      `INSERT INTO transactions (id, "userId", "accountId", "categoryId", type, amount, description, date, reference, status, "remainingAmount")
       VALUES (gen_random_uuid(), $1, $2, NULL, 'DEBT', $3, $4, $5, $6, 'PENDING', $3)
       RETURNING id`,
      [
        userId,
        accountMap['Cuenta Principal'],
        500.0,
        'Préstamo de Carlos para reparación auto',
        daysAgo(25),
        'Carlos Pérez',
      ],
    );
    txCount++;

    // Abono parcial a la deuda
    await queryRunner.query(
      `INSERT INTO transactions (id, "userId", "accountId", "categoryId", type, amount, description, date, reference, status, "relatedTransactionId", "remainingAmount")
       VALUES (gen_random_uuid(), $1, $2, NULL, 'DEBT', $3, $4, $5, $6, 'PENDING', $7, $8)`,
      [
        userId,
        accountMap['Cuenta Principal'],
        200.0,
        'Abono deuda Carlos',
        daysAgo(10),
        'Carlos Pérez',
        debtResult[0].id,
        300.0,
      ],
    );
    txCount++;

    // Préstamo: alguien me debe
    await queryRunner.query(
      `INSERT INTO transactions (id, "userId", "accountId", "categoryId", type, amount, description, date, reference, status, "remainingAmount")
       VALUES (gen_random_uuid(), $1, $2, NULL, 'LOAN', $3, $4, $5, $6, 'PENDING', $3)`,
      [
        userId,
        accountMap['Efectivo'],
        150.0,
        'Le presté a María para almuerzo',
        daysAgo(14),
        'María López',
      ],
    );
    txCount++;

    console.log(`✅ ${txCount} transacciones creadas`);

    await queryRunner.commitTransaction();
    console.log('\n🎉 Seed completado exitosamente');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Error durante el seed, se hizo rollback:', error);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed();
