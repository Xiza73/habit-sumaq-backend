import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';

import { IsOptional, IsString, Matches } from 'class-validator';

import { CreateChoreDto } from './create-chore.dto';

/**
 * Partial-update payload. `startDate` is omitted from `CreateChoreDto` because
 * it's the seed for the very first cycle and changing it after the fact would
 * misalign the chore's history. Adding `nextDueDate` here lets the user shift
 * the next due manually — useful when they realized they did the chore before
 * starting to track, or when the cadence changes mid-stream.
 *
 * Note (decision firmada): updating `intervalValue`/`intervalUnit` does NOT
 * recompute `nextDueDate`. The user can adjust `nextDueDate` themselves if
 * needed — keeps behavior predictable.
 */
export class UpdateChoreDto extends PartialType(OmitType(CreateChoreDto, ['startDate'] as const)) {
  @ApiPropertyOptional({
    description: 'Override manual del próximo vencimiento (YYYY-MM-DD).',
    example: '2026-05-20',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'nextDueDate debe tener formato YYYY-MM-DD' })
  nextDueDate?: string;
}
