import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateMonthlyServiceDto } from './create-monthly-service.dto';

/**
 * Patch payload. `currency` and `startPeriod` are purposely excluded — they
 * are immutable after creation because transactions and period arithmetic
 * depend on them being stable.
 */
export class UpdateMonthlyServiceDto extends PartialType(
  OmitType(CreateMonthlyServiceDto, ['currency', 'startPeriod'] as const),
) {}
