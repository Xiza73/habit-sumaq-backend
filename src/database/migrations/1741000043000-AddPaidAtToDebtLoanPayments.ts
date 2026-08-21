import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * `debt_loan_payments.paidAt` — cuándo se movió realmente el dinero.
 *
 * Hasta ahora la UI mostraba `createdAt` como la fecha del subpago, y ese
 * campo es de **auditoría**: cuándo se escribió la fila. Editarlo para
 * corregir una fecha habría reescrito el registro de cuándo se cargó, que es
 * justamente lo que hace que el audit trail valga algo.
 *
 * Son dos hechos distintos, así que van en dos columnas. El backfill los
 * iguala: para todo lo ya registrado, la única fecha que existía es
 * `createdAt`, y afirmar cualquier otra cosa sería inventar datos.
 */
export class AddPaidAtToDebtLoanPayments1741000043000 implements MigrationInterface {
  name = 'AddPaidAtToDebtLoanPayments1741000043000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debt_loan_payments" ADD COLUMN "paidAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(`UPDATE "debt_loan_payments" SET "paidAt" = "createdAt"`);

    await queryRunner.query(`ALTER TABLE "debt_loan_payments" ALTER COLUMN "paidAt" SET NOT NULL`);

    // The history list orders by the business date now.
    await queryRunner.query(
      `CREATE INDEX "IDX_debt_loan_payments_debtLoanId_paidAt" ON "debt_loan_payments" ("debtLoanId", "paidAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_debt_loan_payments_debtLoanId_paidAt"`);
    // Any corrected date is lost on the way down: the old schema has nowhere
    // to keep it, and `createdAt` must not absorb it — that is the exact
    // conflation this column exists to avoid.
    await queryRunner.query(`ALTER TABLE "debt_loan_payments" DROP COLUMN "paidAt"`);
  }
}
