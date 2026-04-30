import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { SectionRepository } from '../../domain/section.repository';

import type { ReorderSectionsDto } from '../dto/reorder-sections.dto';

@Injectable()
export class ReorderSectionsUseCase {
  constructor(private readonly repo: SectionRepository) {}

  async execute(userId: string, dto: ReorderSectionsDto): Promise<void> {
    const sections = await this.repo.findByUserId(userId);
    const ownedIds = new Set(sections.map((s) => s.id));

    const unknown = dto.orderedIds.filter((id) => !ownedIds.has(id));
    if (unknown.length > 0) {
      throw new DomainException(
        'SECTION_REORDER_INVALID_IDS',
        `Las siguientes secciones no existen o no te pertenecen: ${unknown.join(', ')}`,
      );
    }

    const updates = dto.orderedIds.map((id, index) => ({ id, position: index + 1 }));
    await this.repo.updatePositions(userId, updates);
  }
}
