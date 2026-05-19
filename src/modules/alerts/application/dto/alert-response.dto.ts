import { ApiProperty } from '@nestjs/swagger';

import { AlertSeverity } from '../../domain/enums/alert-severity.enum';
import { AlertType } from '../../domain/enums/alert-type.enum';

import type { Alert } from '../../domain/alert.entity';

/**
 * Wire shape of an alert returned by `GET /alerts`. The `payload` is a
 * generic key-value bag — its actual fields depend on `type`, and the
 * frontend reads them with a discriminated-union helper. We type it
 * loosely here on purpose: adding a new field for a new payload key
 * shouldn't require touching this DTO.
 */
export class AlertResponseDto {
  @ApiProperty({
    example: 'service-due-today:550e8400-e29b-41d4-a716-446655440000:2026-05',
    description:
      'Stable string ID. Used by the dismiss endpoint and persisted in user_alert_dismissals.',
  })
  id: string;

  @ApiProperty({ enum: AlertType, example: AlertType.SERVICE_DUE_TODAY })
  type: AlertType;

  @ApiProperty({ enum: AlertSeverity, example: AlertSeverity.INFO })
  severity: AlertSeverity;

  @ApiProperty({
    description:
      'Whether the user can manually dismiss this alert (per-day policy). Persistent alerts return false here — the UI hides the close button.',
    example: true,
  })
  isDismissable: boolean;

  @ApiProperty({
    description:
      'UTC timestamp the alert first appeared. Frontend compares against lastSeenAt to drive the bell badge.',
    example: '2026-05-01T00:00:00.000Z',
  })
  triggeredAt: string;

  @ApiProperty({
    description:
      'Free-form key-value bag the frontend reads based on `type`. See business-rules.md for the per-type payload shape.',
    additionalProperties: true,
    example: { serviceId: 'abc', serviceName: 'Netflix', dueDay: 15, currency: 'PEN' },
  })
  payload: Record<string, string | number | null>;

  static fromDomain(alert: Alert, isDismissable: boolean): AlertResponseDto {
    const dto = new AlertResponseDto();
    dto.id = alert.id;
    dto.type = alert.type;
    dto.severity = alert.severity;
    dto.isDismissable = isDismissable;
    dto.triggeredAt = alert.triggeredAt.toISOString();
    dto.payload = alert.payload;
    return dto;
  }
}
