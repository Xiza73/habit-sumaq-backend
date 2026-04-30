import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { SectionRepository } from '../../domain/section.repository';

/**
 * Hard-deletes a section. Tasks inside cascade via the FK
 * `ON DELETE CASCADE` — the user opted into this behavior (see Phase C
 * decisions: cascade delete). The frontend warns with a confirm dialog
 * showing the task count before invoking this endpoint.
 */
@Injectable()
export class DeleteSectionUseCase {
  constructor(
    private readonly repo: SectionRepository,
    @InjectPinoLogger(DeleteSectionUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const section = await this.repo.findById(id);
    if (!section || section.userId !== userId) {
      throw new DomainException('SECTION_NOT_FOUND', 'Sección no encontrada');
    }
    await this.repo.deleteById(id);
    this.logger.info({ event: 'section.deleted', sectionId: id, userId }, 'section.deleted');
  }
}
