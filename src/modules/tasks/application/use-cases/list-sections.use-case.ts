import { Injectable } from '@nestjs/common';

import { Section } from '../../domain/section.entity';
import { SectionRepository } from '../../domain/section.repository';

@Injectable()
export class ListSectionsUseCase {
  constructor(private readonly repo: SectionRepository) {}

  async execute(userId: string): Promise<Section[]> {
    return this.repo.findByUserId(userId);
  }
}
