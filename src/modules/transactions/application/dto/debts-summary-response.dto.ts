import { ApiProperty } from '@nestjs/swagger';

export class DebtsSummaryResponseDto {
  @ApiProperty({
    description: 'Referencia normalizada (minúsculas, sin acentos). Llave de agrupación.',
    example: 'juan',
  })
  reference: string;

  @ApiProperty({
    description: 'Nombre a mostrar — el escrito más reciente entre las transacciones',
    example: 'Juan',
  })
  displayName: string;

  @ApiProperty({
    description: 'Suma de saldos pendientes de transacciones DEBT (lo que le debes a esta persona)',
    example: 500,
  })
  pendingDebt: number;

  @ApiProperty({
    description: 'Suma de saldos pendientes de transacciones LOAN (lo que esta persona te debe)',
    example: 300,
  })
  pendingLoan: number;

  @ApiProperty({
    description:
      'Balance neto = pendingLoan - pendingDebt. ' +
      'Positivo = la persona te debe, negativo = tú le debes.',
    example: -200,
  })
  netOwed: number;

  @ApiProperty({
    description: 'Cantidad de transacciones pendientes (incluye parcialmente liquidadas)',
    example: 3,
  })
  pendingCount: number;

  @ApiProperty({
    description: 'Cantidad de transacciones totalmente liquidadas',
    example: 1,
  })
  settledCount: number;
}
