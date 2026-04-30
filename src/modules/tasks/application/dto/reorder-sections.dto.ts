import { ApiProperty } from '@nestjs/swagger';

import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderSectionsDto {
  @ApiProperty({
    type: [String],
    description:
      'IDs de las secciones del usuario en el orden deseado. Reasignamos `position` 1..N en orden. ' +
      'IDs no incluidos quedan donde están — los callers usualmente envían el listado completo.',
    example: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  orderedIds: string[];
}
