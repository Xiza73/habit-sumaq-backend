import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

const DEFAULT_TIMEZONE = 'UTC';

export const ClientTimezone = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const tz = request.headers['x-timezone'] as string | undefined;

  // Validate that it's a real IANA timezone
  if (tz) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }

  return DEFAULT_TIMEZONE;
});
