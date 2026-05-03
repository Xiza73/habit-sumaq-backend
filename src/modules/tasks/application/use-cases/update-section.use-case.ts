import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Section } from '../../domain/section.entity';
import { SectionRepository } from '../../domain/section.repository';

import type { UpdateSectionDto } from '../dto/update-section.dto';

@Injectable()
export class UpdateSectionUseCase {
  constructor(private readonly repo: SectionRepository) {}

  async execute(id: string, userId: string, dto: UpdateSectionDto): Promise<Section> {
    const section = await this.repo.findById(id);
    if (!section || section.userId !== userId) {
      throw new DomainException('SECTION_NOT_FOUND', 'Sección no encontrada');
    }
    section.applyUpdate({
      name: dto.name,
      color: dto.color,
      isCollapsed: dto.isCollapsed,
    });
    return this.repo.save(section);
  }
}
