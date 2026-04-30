import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Sección a la que pertenece la task. Debe pertenecer al usuario.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sectionId: string;

  @ApiProperty({ example: 'Llamar al banco', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional. Soporta markdown — máx 5000 chars.',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
