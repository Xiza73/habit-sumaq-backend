/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import { AppDataSource } from '../data-source';

/**
 * Reset script: limpia toda la información de la BD excepto usuarios.
 * Elimina en orden para respetar las foreign keys.
 *
 * Uso: pnpm migration:reset
 */
async function reset() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    // Orden de eliminación respetando FK constraints
    const tables = ['transactions', 'categories', 'accounts', 'user_settings'];

    for (const table of tables) {
      const result = await queryRunner.query(`DELETE FROM ${table}`);
      const count = Array.isArray(result) ? result.length : result;
      console.log(`🗑️  ${table}: ${typeof count === 'number' ? count : '?'} registros eliminados`);
    }

    await queryRunner.commitTransaction();
    console.log('\n✅ Reset completado. Los usuarios se mantienen intactos.');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Error durante el reset, se hizo rollback:', error);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

reset();
