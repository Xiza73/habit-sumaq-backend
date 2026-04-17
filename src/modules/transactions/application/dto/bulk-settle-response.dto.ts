import { ApiProperty } from '@nestjs/swagger';

export class BulkSettleResponseDto {
  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
    description: 'IDs de las transacciones que pasaron a status=SETTLED',
  })
  settledIds: string[];

  @ApiProperty({
    example: 800,
    description: 'Suma de los saldos pendientes (remainingAmount) que se cerraron',
  })
  totalSettled: number;

  @ApiProperty({
    example: 2,
    description: 'Cantidad de transacciones liquidadas (0 si la referencia no tenía pendientes)',
  })
  count: number;
}
