import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * GET /monthly-service-payments?monthlyServiceId=... — filtra por
 * servicio. Por ahora `monthlyServiceId` es obligatorio (la UI siempre
 * lista pagos dentro de un servicio específico, no cross-servicio).
 */
export class GetMonthlyServicePaymentsQueryDto {
  @ApiProperty({
    description: 'ID del monthly service cuyos pagos listar.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  monthlyServiceId: string;
}
