import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { FinancesDashboardResponseDto } from '../application/dto/finances-dashboard-response.dto';
import { GetReportsQueryDto } from '../application/dto/get-reports-query.dto';
import { RoutinesDashboardResponseDto } from '../application/dto/routines-dashboard-response.dto';
import { GetFinancesDashboardUseCase } from '../application/use-cases/get-finances-dashboard.use-case';
import { GetRoutinesDashboardUseCase } from '../application/use-cases/get-routines-dashboard.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly getFinancesDashboard: GetFinancesDashboardUseCase,
    private readonly getRoutinesDashboard: GetRoutinesDashboardUseCase,
  ) {}

  @Get('finances-dashboard')
  @ApiOperation({
    summary: 'Dashboard de Finanzas',
    description:
      'Devuelve una foto agregada del módulo de Finanzas para el período solicitado: ' +
      'balance total por moneda, income vs expense, top 5 categorías de gasto, flujo diario ' +
      'y resumen de deudas pendientes. Rango default: `month`.',
  })
  @ApiResponse({ status: 200, type: FinancesDashboardResponseDto })
  async finances(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetReportsQueryDto,
  ): Promise<ApiResponseDto<FinancesDashboardResponseDto>> {
    const dto = await this.getFinancesDashboard.execute(payload.sub, query.period);
    return ApiResponseDto.ok(dto, 'Dashboard de Finanzas');
  }

  @Get('routines-dashboard')
  @ApiOperation({
    summary: 'Dashboard de Rutinas',
    description:
      'Devuelve top de rachas de hábitos, completitud diaria de hábitos y resumen del ' +
      'día para las tareas diarias (Diarias). El período controla el rango declarado ' +
      'pero las métricas "hoy" siempre usan la zona horaria del usuario.',
  })
  @ApiResponse({ status: 200, type: RoutinesDashboardResponseDto })
  async routines(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetReportsQueryDto,
  ): Promise<ApiResponseDto<RoutinesDashboardResponseDto>> {
    const dto = await this.getRoutinesDashboard.execute(payload.sub, query.period);
    return ApiResponseDto.ok(dto, 'Dashboard de Rutinas');
  }
}
