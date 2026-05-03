import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Section } from '../../domain/section.entity';

export class SectionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'UUID del usuario propietario' })
  userId: string;

  @ApiProperty({ example: 'Trabajo' })
  name: string;

  @ApiPropertyOptional({ example: '#FF6B35', nullable: true })
  color: string | null;

  @ApiProperty({ example: 1, description: 'Posición 1-indexed dentro de la lista del usuario' })
  position: number;

  @ApiProperty({
    example: false,
    description:
      'Si el header de la sección está colapsado en el dashboard de tareas. Default false (expandido).',
  })
  isCollapsed: boolean;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;

  static fromDomain(section: Section): SectionResponseDto {
    const dto = new SectionResponseDto();
    dto.id = section.id;
    dto.userId = section.userId;
    dto.name = section.name;
    dto.color = section.color;
    dto.position = section.position;
    dto.isCollapsed = section.isCollapsed;
    dto.createdAt = section.createdAt;
    dto.updatedAt = section.updatedAt;
    return dto;
  }
}
