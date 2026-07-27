export interface MonthlyServiceParticipantProps {
  id: string;
  monthlyServiceId: string;
  userId: string;
  reference: string;
  normalizedReference: string;
  defaultAmount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * A single entry in a shared monthly service's split config — one person
 * (`reference`) and the fixed default amount they owe when the service is
 * paid. `normalizedReference` mirrors `reference` through
 * `common/text/normalize-reference.ts` and is what the DB partial unique
 * index (`UQ_msp_service_normalized_reference_active`) enforces
 * one-per-service uniqueness on.
 *
 * Slice 1 (this entity): config only. Linking to `debts_loans` rows on
 * payment happens in a later slice.
 */
export class MonthlyServiceParticipant {
  readonly id: string;
  readonly monthlyServiceId: string;
  readonly userId: string;
  reference: string;
  normalizedReference: string;
  defaultAmount: number;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: MonthlyServiceParticipantProps) {
    MonthlyServiceParticipant.assertPositiveAmount(props.defaultAmount);

    this.id = props.id;
    this.monthlyServiceId = props.monthlyServiceId;
    this.userId = props.userId;
    this.reference = props.reference;
    this.normalizedReference = props.normalizedReference;
    this.defaultAmount = props.defaultAmount;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /**
   * Replaces `defaultAmount` (edit flow). Sum-vs-estimatedAmount validation
   * is a cross-entity concern handled by the use case, not here.
   */
  updateDefaultAmount(amount: number): void {
    MonthlyServiceParticipant.assertPositiveAmount(amount);
    this.defaultAmount = amount;
    this.updatedAt = new Date();
  }

  private static assertPositiveAmount(amount: number): void {
    if (amount <= 0) {
      throw new Error('El monto por defecto debe ser mayor a 0');
    }
  }
}
