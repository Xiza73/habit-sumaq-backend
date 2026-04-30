import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Section } from '../../domain/section.entity';
import { SectionRepository } from '../../domain/section.repository';

import type { CreateSectionDto } from '../dto/create-section.dto';

/**
 * Creates a section and appends it to the END of the user's section list.
 * `position` is computed as `maxPosition + 1` so existing sections aren't
 * disturbed.
 */
@Injectable()
export class CreateSectionUseCase {
  constructor(private readonly repo: SectionRepository) {}

  async execute(userId: string, dto: CreateSectionDto): Promise<Section> {
    const maxPosition = await this.repo.maxPositionByUserId(userId);
    const now = new Date();
    const section = new Section(
      randomUUID(),
      userId,
      dto.name,
      dto.color ?? null,
      (maxPosition ?? 0) + 1,
      now,
      now,
    );
    return this.repo.save(section);
  }
}
