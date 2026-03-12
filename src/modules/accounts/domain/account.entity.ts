import { type AccountType } from './enums/account-type.enum';
import { type Currency } from './enums/currency.enum';

export class Account {
  constructor(
    readonly id: string,
    readonly userId: string,
    public name: string,
    public type: AccountType,
    public currency: Currency,
    public balance: number,
    public color: string | null,
    public icon: string | null,
    public isArchived: boolean,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /** Incrementa el saldo. Usado al registrar un ingreso o transferencia entrante. */
  credit(amount: number): void {
    this.balance += amount;
    this.updatedAt = new Date();
  }

  /** Decrementa el saldo. Usado al registrar un gasto o transferencia saliente. */
  debit(amount: number): void {
    this.balance -= amount;
    this.updatedAt = new Date();
  }

  /** Oculta la cuenta sin eliminarla. Mantiene el historial intacto. */
  archive(): void {
    this.isArchived = true;
    this.updatedAt = new Date();
  }

  /** Reactiva una cuenta archivada. */
  restore(): void {
    this.isArchived = false;
    this.updatedAt = new Date();
  }

  /** Actualiza los campos editables. Solo nombre, color e ícono son modificables. */
  updateProfile(name: string, color: string | null, icon: string | null): void {
    this.name = name;
    this.color = color;
    this.icon = icon;
    this.updatedAt = new Date();
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
