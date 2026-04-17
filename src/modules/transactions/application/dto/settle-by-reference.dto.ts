import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SettleByReferenceDto {
  @ApiProperty({
    example: 'Juan',
    description:
      'Referencia a liquidar. Normalizada server-side (case + accent insensitive) — "Juán", "Juan", "JUAN" son la misma persona.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reference: string;
}
