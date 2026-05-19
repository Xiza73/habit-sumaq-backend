import { ApiProperty } from '@nestjs/swagger';

import { AlertResponseDto } from './alert-response.dto';

/**
 * Wire shape of `GET /alerts`. Includes the user's `lastAlertsSeenAt`
 * timestamp so the frontend can compute the badge count locally without
 * a separate roundtrip. Null when the user has never opened the popover.
 */
export class AlertsListResponseDto {
  @ApiProperty({ type: [AlertResponseDto] })
  alerts: AlertResponseDto[];

  @ApiProperty({
    nullable: true,
    description:
      "UTC timestamp the user last opened the alerts popover. Null when they've never opened it. Frontend badge counts alerts with `triggeredAt > lastSeenAt`.",
    example: '2026-05-18T14:32:11.456Z',
  })
  lastSeenAt: string | null;
}
