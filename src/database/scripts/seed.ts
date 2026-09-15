/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AppDataSource } from '../data-source';

/**
 * Seed script: llena la BD con datos de prueba.
 * Condiciones:
 *   - Solo se hará el seed a un usuario específico.
 *   - Cada módulo verifica si ya tiene data; si la tiene, se omite.
 *   - Los módulos se ejecutan de forma independiente (uno puede fallar sin afectar al resto).
 *
 * Uso: pnpm migration:seed
 *      SEED_EMAIL=otro@correo.com pnpm migration:seed
 *
 * El usuario debe existir ANTES de correr esto: el script lo busca y aborta si
 * no lo encuentra. Y tiene que haber entrado por Google OAuth de verdad —
 * `findOrCreateUser` resuelve por `googleId`, no por email, y `users.email` es
 * único, así que un usuario creado por otra vía (p.ej. `test-login`) hace que
 * su login real después choque contra `UQ_users_email` y falle.
 */

/** Cuenta a sembrar. Override con `SEED_EMAIL` para usar otra. */
const SEED_EMAIL = process.env.SEED_EMAIL ?? 'gvnner73@gmail.com';

// ── Helpers ──────────────────────────────────────────────────────────
const dateStr = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

/** Período `YYYY-MM` de hace `months` meses. */
const periodStr = (months: number): string => {
  const d = new Date();
  d.setDate(1); // el 1 evita el salto de mes al restar desde un día 29-31
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 7);
};

/** `dateStr` camina hacia atrás; esto es lo mismo hacia adelante. */
const dueInDays = (days: number): string => dateStr(-days);

async function seed() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    // ── Buscar usuario ──────────────────────────────────────────────
    const users = await queryRunner.query(
      `SELECT id FROM users WHERE email = $1 AND "deletedAt" IS NULL`,
      [SEED_EMAIL],
    );

    const userId: string = users[0]?.id;

    if (!userId) {
      console.error(`❌ Usuario ${SEED_EMAIL} no encontrado. Abortando seed.`);
      console.error('   Entra primero al app con esa cuenta por Google OAuth.');
      process.exit(1);
    }

    console.log(`👤 Sembrando para ${SEED_EMAIL}`);

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
    } else {
      console.log('⏭️  User settings ya existen, omitiendo');
    }

    // ── Escudo en mano ────────────────────────────────────────────
    // Con un escudo disponible el botón de rescate es usable desde el primer
    // minuto, sin tener que ganarse uno antes. `shieldsEarnedMonth` queda en
    // NULL a propósito: así el OTRO camino — ganarlo registrando "Escribir" —
    // también se puede probar en la misma sesión.
    //
    // El chequeo previo es para no pisar el estado que dejes probando si
    // vuelves a correr el seed.
    const currentShields = await queryRunner.query(
      `SELECT "streakShields" FROM user_settings WHERE "userId" = $1`,
      [userId],
    );

    if (currentShields[0]?.streakShields === 0) {
      await queryRunner.query(
        `UPDATE user_settings SET "streakShields" = 1, "shieldsEarnedMonth" = NULL
         WHERE "userId" = $1`,
        [userId],
      );
      console.log('✅ 1 escudo de racha otorgado');
    } else {
      console.log('⏭️  El usuario ya tiene escudos, omitiendo');
    }

    // ── Categorías ────────────────────────────────────────────────
    // Vivían anidadas dentro del bloque de Cuentas, que insertaba en tablas
    // que la migración v1 borró (`accounts`, `transactions`). Como todo el
    // seed corre en UNA transacción, ese fallo hacía rollback de todo y el
    // script no sembraba nada — llevaba muerto desde entonces sin que nadie
    // lo notara. Las categorías sobreviven acá porque su tabla sigue viva y
    // la usan presupuestos, servicios mensuales y deudas.
    const existingCategories = await queryRunner.query(
      `SELECT id FROM categories WHERE "userId" = $1 AND "deletedAt" IS NULL`,
      [userId],
    );

    if (existingCategories.length > 0) {
      console.log(`⏭️  El usuario ya tiene ${existingCategories.length} categoría(s), omitiendo`);
    } else {
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

      for (const cat of categoriesData) {
        await queryRunner.query(
          `INSERT INTO categories (id, "userId", name, type, color, icon, "isDefault")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)`,
          [userId, cat.name, cat.type, cat.color, cat.icon],
        );
      }

      console.log(`✅ ${categoriesData.length} categorías creadas`);
    }

    // ── Hábitos ───────────────────────────────────────────────────
    const existingHabits = await queryRunner.query(
      `SELECT id FROM habits WHERE "userId" = $1 AND "deletedAt" IS NULL`,
      [userId],
    );

    if (existingHabits.length > 0) {
      console.log(`⏭️  El usuario ya tiene ${existingHabits.length} hábito(s), omitiendo hábitos`);
    } else {
      // ── Crear hábitos ──
      const habitsData = [
        {
          name: 'Tomar agua',
          description: '8 vasos de agua al día',
          frequency: 'DAILY',
          targetCount: 8,
          color: '#3B82F6',
          icon: 'droplet',
        },
        {
          name: 'Ejercicio',
          description: 'Mínimo 30 minutos de actividad física',
          frequency: 'DAILY',
          targetCount: 1,
          color: '#EF4444',
          icon: 'dumbbell',
        },
        {
          name: 'Leer',
          description: 'Leer al menos 20 páginas',
          frequency: 'DAILY',
          targetCount: 1,
          color: '#8B5CF6',
          icon: 'book',
        },
        {
          name: 'Meditar',
          description: '10 minutos de meditación mindfulness',
          frequency: 'DAILY',
          targetCount: 1,
          color: '#10B981',
          icon: 'brain',
        },
        // Los dos de abajo existen para que F7 (escudos de racha) se pueda
        // probar. El resto del seed no llega: su racha más larga es de 4 días
        // y el umbral para ganar un escudo es 20.
        {
          name: 'Escribir',
          description: 'Racha intacta de 30 días — registrar hoy otorga un escudo',
          frequency: 'DAILY',
          targetCount: 1,
          color: '#EC4899',
          icon: 'pen',
        },
        {
          name: 'Estirar',
          description: 'Racha rota AYER, con anteayer completo — período rescatable',
          frequency: 'DAILY',
          targetCount: 1,
          color: '#14B8A6',
          icon: 'activity',
        },
        {
          name: 'Limpiar casa',
          description: 'Limpieza general semanal',
          frequency: 'WEEKLY',
          targetCount: 1,
          color: '#F59E0B',
          icon: 'sparkles',
        },
        {
          name: 'Revisar finanzas',
          description: 'Revisar gastos y presupuesto de la semana',
          frequency: 'WEEKLY',
          targetCount: 1,
          color: '#6366F1',
          icon: 'chart-bar',
        },
      ];

      const insertedHabits: { name: string; id: string; frequency: string; targetCount: number }[] =
        [];

      for (const h of habitsData) {
        const result = await queryRunner.query(
          `INSERT INTO habits (id, "userId", name, description, frequency, "targetCount", color, icon, "isArchived")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false)
           RETURNING id`,
          [userId, h.name, h.description, h.frequency, h.targetCount, h.color, h.icon],
        );
        insertedHabits.push({
          name: h.name,
          id: result[0].id,
          frequency: h.frequency,
          targetCount: h.targetCount,
        });
      }

      console.log(`✅ ${insertedHabits.length} hábitos creados`);

      // ── Crear logs de hábitos (últimos 30 días) ──
      // Simulamos un usuario realista: no perfecto, con rachas y días perdidos

      const habitMap = Object.fromEntries(insertedHabits.map((h) => [h.name, h]));

      // Días donde el usuario NO completó ciertos hábitos (para hacerlo realista)
      const missedDays: Record<string, Set<number>> = {
        'Tomar agua': new Set([4, 11, 17, 23, 28]),
        Ejercicio: new Set([2, 5, 8, 13, 16, 20, 24, 27]),
        Leer: new Set([3, 7, 10, 14, 19, 22, 26]),
        Meditar: new Set([1, 6, 9, 12, 15, 18, 21, 25, 29]),
        // Ni un día perdido. Hoy queda SIN registrar a propósito: el cálculo
        // arranca en ayer cuando hoy no está completo, así que la racha llega
        // a 30 y registrar hoy dispara el otorgamiento del escudo.
        Escribir: new Set<number>(),
        // Solo ayer. Anteayer SÍ está, que es exactamente lo que
        // `findRescuableDate` exige: hueco en el período anterior, sostenido
        // en el de antes.
        Estirar: new Set([1]),
      };

      // Días parciales para "Tomar agua" (no llegó a los 8 vasos)
      const partialWaterDays: Record<number, number> = {
        2: 5,
        6: 3,
        9: 6,
        15: 4,
        21: 7,
        25: 2,
      };

      let logCount = 0;

      // Logs diarios (últimos 30 días, excepto hoy = día 0)
      for (let day = 1; day <= 30; day++) {
        for (const habitName of [
          'Tomar agua',
          'Ejercicio',
          'Leer',
          'Meditar',
          'Escribir',
          'Estirar',
        ]) {
          const habit = habitMap[habitName];
          const missed = missedDays[habitName]?.has(day) ?? false;

          if (missed) continue; // Día que no registró nada

          let count: number;
          let completed: boolean;
          let note: string | null = null;

          if (habitName === 'Tomar agua' && partialWaterDays[day] !== undefined) {
            count = partialWaterDays[day];
            completed = false;
            note = `Solo ${count} vasos hoy`;
          } else {
            count = habit.targetCount;
            completed = true;
          }

          await queryRunner.query(
            `INSERT INTO habit_logs (id, "habitId", "userId", date, count, completed, note, "targetCount")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
            [habit.id, userId, dateStr(day), count, completed, note, habit.targetCount],
          );
          logCount++;
        }
      }

      // Logs semanales (últimas 4 semanas: día 7, 14, 21, 28)
      const weeklyDays = [7, 14, 21, 28];
      const weeklyMissed: Record<string, Set<number>> = {
        'Limpiar casa': new Set([21]), // Una semana no limpió
        'Revisar finanzas': new Set([14, 28]), // Dos semanas no revisó
      };

      for (const day of weeklyDays) {
        for (const habitName of ['Limpiar casa', 'Revisar finanzas']) {
          const habit = habitMap[habitName];
          const missed = weeklyMissed[habitName]?.has(day) ?? false;

          if (missed) continue;

          await queryRunner.query(
            `INSERT INTO habit_logs (id, "habitId", "userId", date, count, completed, note, "targetCount")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
            [habit.id, userId, dateStr(day), habit.targetCount, true, null, habit.targetCount],
          );
          logCount++;
        }
      }

      // Log de hoy para algunos hábitos (simula que ya empezó el día)
      const todayHabits = [
        { name: 'Tomar agua', count: 3, completed: false, note: 'Voy por el tercer vaso' },
        { name: 'Meditar', count: 1, completed: true, note: 'Sesión matutina' },
      ];

      for (const th of todayHabits) {
        const habit = habitMap[th.name];
        await queryRunner.query(
          `INSERT INTO habit_logs (id, "habitId", "userId", date, count, completed, note, "targetCount")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
          [habit.id, userId, dateStr(0), th.count, th.completed, th.note, habit.targetCount],
        );
        logCount++;
      }

      console.log(`✅ ${logCount} registros de hábitos creados`);
    }

    // ── Quehaceres ────────────────────────────────────────────────
    const existingChores = await queryRunner.query(
      `SELECT id FROM chores WHERE "userId" = $1 AND "deletedAt" IS NULL`,
      [userId],
    );

    if (existingChores.length > 0) {
      console.log(`⏭️  El usuario ya tiene ${existingChores.length} quehacer(es), omitiendo`);
    } else {
      // Uno por cada estado del chip. La ventana de "próximo" es
      // cadencia ÷ 7 acotada a [1, 7] (ver `upcomingWindowDays` en el web),
      // así que la cadencia de cada uno está elegida para que su
      // `nextDueDate` caiga del lado correcto de esa ventana — si no, los
      // cuatro terminan pintados igual y el seed no prueba nada.
      const choresData = [
        {
          // 30 días de cadencia → ventana 4. Vencido hace 5.
          name: 'Cambiar las sábanas',
          category: 'Hogar',
          notes: null,
          intervalValue: 1,
          intervalUnit: 'months',
          dueIn: -5,
          lastDone: 35,
        },
        {
          // 14 días → ventana 2. Vence hoy.
          name: 'Regar las plantas del balcón',
          category: 'Hogar',
          notes: 'Las suculentas no, se pudren',
          intervalValue: 2,
          intervalUnit: 'weeks',
          dueIn: 0,
          lastDone: 14,
        },
        {
          // 42 días → ventana 6. Vence en 3, así que cae dentro.
          // Nombre largo + categoría a propósito: es el caso de F5, donde el
          // nombre empujaba la etiqueta y el chip hacia abajo y estiraba la
          // card. Acá se ve si el truncado aguanta.
          name: 'Cambiar el filtro del purificador de agua de la cocina',
          category: 'Mantenimiento',
          notes: null,
          intervalValue: 6,
          intervalUnit: 'weeks',
          dueIn: 3,
          lastDone: 39,
        },
        {
          // 365 días → ventana 7 (tope). Vence en 90, muy afuera.
          name: 'Renovar el SOAT',
          category: 'Trámites',
          notes: 'Sale más barato renovando antes del vencimiento',
          intervalValue: 1,
          intervalUnit: 'years',
          dueIn: 90,
          lastDone: 275,
        },
      ];

      for (const c of choresData) {
        await queryRunner.query(
          `INSERT INTO chores (id, "userId", name, notes, category, "intervalValue", "intervalUnit",
                               "startDate", "lastDoneDate", "nextDueDate", "isActive")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
          [
            userId,
            c.name,
            c.notes,
            c.category,
            c.intervalValue,
            c.intervalUnit,
            dateStr(c.lastDone),
            dateStr(c.lastDone),
            dueInDays(c.dueIn),
          ],
        );
      }

      console.log(
        `✅ ${choresData.length} quehaceres creados (vencido / hoy / próximo / horizonte)`,
      );
    }

    // ── Finanzas ──────────────────────────────────────────────────
    // Presupuestos, servicios mensuales y deudas/préstamos. Reemplaza al bloque
    // de Cuentas/Transacciones que se borró: esas tablas ya no existen y el
    // modelo de hoy es otro.
    //
    // El chequeo va sobre presupuestos y cubre las tres cosas a la vez: se
    // siembran juntas o no se siembran, porque el saldo del pool depende de
    // TODAS ellas.
    const existingBudgets = await queryRunner.query(
      `SELECT id FROM budgets WHERE "userId" = $1 AND "deletedAt" IS NULL`,
      [userId],
    );

    if (existingBudgets.length > 0) {
      console.log(
        `⏭️  El usuario ya tiene ${existingBudgets.length} presupuesto(s), omitiendo finanzas`,
      );
    } else {
      // Tipado explícito: `queryRunner.query` devuelve `any`, y este helper es
      // el único punto del seed que LEE una fila en vez de solo insertarla.
      const catRows = (await queryRunner.query(
        `SELECT id, name FROM categories WHERE "userId" = $1 AND "deletedAt" IS NULL`,
        [userId],
      )) as { id: string; name: string }[];
      const catId = (name: string): string =>
        catRows.find((c) => c.name === name)?.id ?? catRows[0].id;

      const now = new Date();
      const CURRENCY = 'PEN';
      // Saldo de partida del pool. Todo lo que se gasta abajo se descuenta de
      // acá al final, así el número que ve el usuario cuadra con sus
      // movimientos en vez de ser un valor suelto.
      const POOL_START = 4000;
      let spent = 0;

      // ── Presupuesto del mes en curso ──
      const budget = await queryRunner.query(
        `INSERT INTO budgets (id, "userId", year, month, currency, amount)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
        [userId, now.getFullYear(), now.getMonth() + 1, CURRENCY, 1200],
      );
      const budgetId: string = budget[0].id;

      const movements = [
        { cat: 'Restaurantes', amount: 45.5, desc: 'Almuerzo con el equipo', daysAgo: 1 },
        { cat: 'Transporte', amount: 18, desc: 'Taxi al aeropuerto', daysAgo: 3 },
        { cat: 'Entretenimiento', amount: 60, desc: 'Cine y cena', daysAgo: 6 },
        { cat: 'Alimentación', amount: 132.4, desc: 'Compra de la semana', daysAgo: 9 },
      ];

      for (const m of movements) {
        await queryRunner.query(
          `INSERT INTO budget_movements (id, "userId", "budgetId", "categoryId", currency, amount, description, date)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
          [userId, budgetId, catId(m.cat), CURRENCY, m.amount, m.desc, dateStr(m.daysAgo)],
        );
        spent += m.amount;
      }
      console.log(`✅ 1 presupuesto con ${movements.length} movimientos`);

      // ── Servicios mensuales ──
      // Uno pagado al día y otro con el pago del mes pendiente, para que la
      // vista muestre los dos estados.
      const services = [
        { name: 'Netflix', cat: 'Entretenimiento', amount: 44.9, dueDay: 12, paidUpTo: 0 },
        { name: 'Internet', cat: 'Servicios', amount: 129, dueDay: 5, paidUpTo: 1 },
      ];

      let paymentCount = 0;
      for (const svc of services) {
        const row = await queryRunner.query(
          `INSERT INTO monthly_services (id, "userId", name, "categoryId", currency, "frequencyMonths",
                                         "estimatedAmount", "dueDay", "startPeriod", "lastPaidPeriod", "isActive")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, $5, $6, $7, $8, true) RETURNING id`,
          [
            userId,
            svc.name,
            catId(svc.cat),
            CURRENCY,
            svc.amount,
            svc.dueDay,
            periodStr(6),
            periodStr(svc.paidUpTo),
          ],
        );
        // Historial de pagos hasta el período marcado como pagado.
        for (let back = svc.paidUpTo; back <= svc.paidUpTo + 2; back++) {
          await queryRunner.query(
            `INSERT INTO monthly_service_payments (id, "userId", "monthlyServiceId", currency, amount, period, description, date)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NULL, $6)`,
            [userId, row[0].id, CURRENCY, svc.amount, periodStr(back), dateStr(back * 30)],
          );
          spent += svc.amount;
          paymentCount++;
        }
      }
      console.log(`✅ ${services.length} servicios mensuales con ${paymentCount} pagos`);

      // ── Deudas y préstamos ──
      // Un préstamo con abono parcial (PENDING con remaining < amount) y una
      // deuda saldada: los dos estados que la lista distingue.
      const loan = await queryRunner.query(
        `INSERT INTO debts_loans (id, "userId", type, "categoryId", currency, amount, "remainingAmount",
                                  status, reference, description, date)
         VALUES (gen_random_uuid(), $1, 'LOAN', $2, $3, 300, 180, 'PENDING', $4, $5, $6) RETURNING id`,
        [
          userId,
          catId('Regalos Recibidos'),
          CURRENCY,
          'María López',
          'Le presté para la mudanza',
          dateStr(20),
        ],
      );
      await queryRunner.query(
        `INSERT INTO debt_loan_payments (id, "debtLoanId", amount, currency, note, "paidAt")
         VALUES (gen_random_uuid(), $1, 120, $2, 'Primer abono', $3)`,
        [loan[0].id, CURRENCY, dateStr(5)],
      );

      await queryRunner.query(
        `INSERT INTO debts_loans (id, "userId", type, "categoryId", currency, amount, "remainingAmount",
                                  status, reference, description, date)
         VALUES (gen_random_uuid(), $1, 'DEBT', $2, $3, 250, 0, 'SETTLED', $4, $5, $6)`,
        [userId, catId('Salud'), CURRENCY, 'Carlos Ruiz', 'Me cubrió la consulta', dateStr(45)],
      );
      console.log('✅ 1 préstamo con abono parcial + 1 deuda saldada');

      // ── Pool de moneda ──
      // `currency_pools` es el saldo corriente y NO se actualiza solo: la app
      // lo mueve con `CurrencyPoolService.applyDelta` dentro de la transacción
      // de cada caso de uso. Sembrando por SQL hay que calcularlo acá, o el
      // saldo miente sobre los movimientos recién insertados.
      //
      // Gastar RESTA — la app pasa `-amount` al crear un movimiento o pagar un
      // servicio — así que el saldo es el inicial menos todo lo gastado.
      await queryRunner.query(
        `INSERT INTO currency_pools (id, "userId", currency, balance)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [userId, CURRENCY, POOL_START - spent],
      );
      console.log(
        `✅ Pool ${CURRENCY}: ${POOL_START} - ${spent.toFixed(2)} = ${(POOL_START - spent).toFixed(2)}`,
      );
    }

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
