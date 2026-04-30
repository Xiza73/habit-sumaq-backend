import { ApiProperty } from '@nestjs/swagger';

import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderTasksDto {
  @ApiProperty({
    description:
      'Sección dentro de la cual se reordenan las tasks. Todas las IDs en `orderedIds` deben pertenecer a esta sección.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sectionId: string;

  @ApiProperty({
    type: [String],
    description: 'IDs de las tasks en el orden deseado dentro de la sección. Se renumeran 1..N.',
    example: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  orderedIds: string[];
}
