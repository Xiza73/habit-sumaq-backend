import { ApiProperty } from '@nestjs/swagger';

import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderQuickTasksDto {
  @ApiProperty({
    description:
      'IDs de las tareas en el orden deseado. El backend renumera las posiciones a 1..N (ignora las no listadas).',
    type: [String],
    example: ['uuid-a', 'uuid-b', 'uuid-c'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
