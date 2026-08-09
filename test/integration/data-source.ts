import path from 'path';
import { DataSource } from 'typeorm';

import 'dotenv/config';

/**
 * DataSource for the integration suite.
 *
 * Points at a SEPARATE database from development — these tests truncate every
 * table between cases. `TEST_DB_NAME` defaults to `habit_sumaq_test`; the
 * remaining connection settings fall back to the normal `DB_*` vars so a
 * local `docker compose up -d postgres` needs no extra configuration.
 */
const databaseName = process.env.TEST_DB_NAME ?? 'habit_sumaq_test';

/**
 * Refuse to touch a database whose name does not read as a test database.
 * The harness truncates tables; pointing this at `habit_sumaq` by a stray
 * `TEST_DB_NAME` export would wipe real data. Cheap rail, catastrophic
 * failure avoided.
 */
if (!/test/i.test(databaseName)) {
  throw new Error(
    `Refusing to run the integration suite against "${databaseName}": the ` +
      `database name must contain "test". This suite truncates every table.`,
  );
}

export const TestDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 5432),
  database: databaseName,
  username: process.env.TEST_DB_USER ?? process.env.DB_USER ?? 'postgres',
  password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? 'secret',
  entities: [path.join(__dirname, '../../src/**/*.orm-entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../../src/database/migrations/*{.ts,.js}')],
  synchronize: false,
  // Every concurrency test needs at least two live connections so the two
  // transactions can actually contend. The default pool is larger than this,
  // but stating it makes the requirement explicit rather than incidental.
  extra: { max: 10 },
});
