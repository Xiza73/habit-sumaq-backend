import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ClientTimezone } from '@common/decorators/client-timezone.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { AlertResponseDto } from '../application/dto/alert-response.dto';
import { AlertsListResponseDto } from '../application/dto/alerts-list-response.dto';
import { DismissAlertUseCase } from '../application/use-cases/dismiss-alert.use-case';
import { GetAlertsForUserUseCase } from '../application/use-cases/get-alerts.use-case';
import { MarkAlertsSeenUseCase } from '../application/use-cases/mark-alerts-seen.use-case';
import { isDismissable } from '../domain/alert-dismiss-policy';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly getAlerts: GetAlertsForUserUseCase,
    private readonly dismissAlert: DismissAlertUseCase,
    private readonly markAlertsSeen: MarkAlertsSeenUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar las alertas activas del usuario',
    description:
      'Computa las alertas al vuelo desde servicios mensuales, hábitos, presupuestos y chores. ' +
      'Filtra las que tienen un dismiss activo (per-day). Devuelve también `lastSeenAt` para que ' +
      'el frontend calcule el badge del bell sin un segundo roundtrip.',
  })
  @ApiResponse({ status: 200, type: AlertsListResponseDto })
  async list(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
  ): Promise<ApiResponseDto<AlertsListResponseDto>> {
    const result = await this.getAlerts.execute(payload.sub, timezone);
    const dto = new AlertsListResponseDto();
    dto.alerts = result.alerts.map((a) => AlertResponseDto.fromDomain(a, isDismissable(a.type)));
    dto.lastSeenAt = result.lastSeenAt?.toISOString() ?? null;
    return ApiResponseDto.ok(dto, 'Alertas obtenidas exitosamente');
  }

  @Post(':alertId/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar una alerta hasta medianoche en la timezone del usuario',
    description:
      'Solo aplica a alertas con dismiss-policy `per-day` (servicios due hoy, hábitos al mediodía). ' +
      'Las persistentes (servicios overdue, budget overspent, chore overdue) rechazan con ALR_001 — ' +
      'su contrato es "se va al resolverse", no manual.',
  })
  @ApiParam({
    name: 'alertId',
    description: 'Stable string ID del Alert, tal como llegó en GET /alerts',
  })
  @ApiResponse({ status: 204, description: 'Dismiss registrado' })
  @ApiResponse({
    status: 409,
    description: 'ALR_001: la alerta no es dismissable (policy persistent)',
  })
  async dismiss(
    @CurrentUser() payload: JwtPayload,
    @Param('alertId') alertId: string,
  ): Promise<void> {
    await this.dismissAlert.execute(payload.sub, alertId);
  }

  @Post('mark-seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Bumpear lastAlertsSeenAt al timestamp actual',
    description:
      'Llamado por el frontend cuando el usuario abre el popover del bell. Hace que el badge ' +
      '(alertas con triggeredAt > lastSeenAt) baje a 0 — la próxima GET /alerts ya retorna el ' +
      'nuevo lastSeenAt.',
  })
  @ApiResponse({ status: 204, description: 'lastAlertsSeenAt actualizado' })
  async markSeen(@CurrentUser() payload: JwtPayload): Promise<void> {
    await this.markAlertsSeen.execute(payload.sub);
  }
}
