import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ClientTimezone } from '@common/decorators/client-timezone.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { ChoreLogResponseDto } from '../application/dto/chore-log-response.dto';
import { ChoreResponseDto } from '../application/dto/chore-response.dto';
import { CreateChoreDto } from '../application/dto/create-chore.dto';
import { MarkChoreDoneDto } from '../application/dto/mark-chore-done.dto';
import { SkipChoreDto } from '../application/dto/skip-chore.dto';
import { UpdateChoreDto } from '../application/dto/update-chore.dto';
import { ArchiveChoreUseCase } from '../application/use-cases/archive-chore.use-case';
import { CreateChoreUseCase } from '../application/use-cases/create-chore.use-case';
import { DeleteChoreUseCase } from '../application/use-cases/delete-chore.use-case';
import { GetChoreUseCase } from '../application/use-cases/get-chore.use-case';
import { ListChoreLogsUseCase } from '../application/use-cases/list-chore-logs.use-case';
import { ListChoresUseCase } from '../application/use-cases/list-chores.use-case';
import { MarkChoreDoneUseCase } from '../application/use-cases/mark-chore-done.use-case';
import { SkipChoreCycleUseCase } from '../application/use-cases/skip-chore-cycle.use-case';
import { UpdateChoreUseCase } from '../application/use-cases/update-chore.use-case';
import { todayInTimezone } from '../infrastructure/timezone/today-in-timezone';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

/** Caps for `GET /chores/:id/logs` pagination. */
const LOGS_DEFAULT_LIMIT = 20;
const LOGS_MAX_LIMIT = 100;

@ApiTags('Chores')
@ApiBearerAuth()
@Controller('chores')
export class ChoresController {
  constructor(
    private readonly listChores: ListChoresUseCase,
    private readonly getChore: GetChoreUseCase,
    private readonly listChoreLogs: ListChoreLogsUseCase,
    private readonly createChore: CreateChoreUseCase,
    private readonly updateChore: UpdateChoreUseCase,
    private readonly markChoreDone: MarkChoreDoneUseCase,
    private readonly skipChoreCycle: SkipChoreCycleUseCase,
    private readonly archiveChore: ArchiveChoreUseCase,
    private readonly deleteChore: DeleteChoreUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar tareas recurrentes (chores) del usuario',
    description:
      'Por defecto retorna sólo activas. Usar ?includeArchived=true para incluir archivadas. ' +
      'Cada item incluye `isOverdue` calculado con el día actual en la timezone del header x-timezone.',
  })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista de chores', type: [ChoreResponseDto] })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<ApiResponseDto<ChoreResponseDto[]>> {
    const includeArchivedFlag = includeArchived === 'true';
    const chores = await this.listChores.execute(payload.sub, includeArchivedFlag);
    const currentDate = todayInTimezone(timezone);
    return ApiResponseDto.ok(
      chores.map((c) => ChoreResponseDto.fromDomain(c, currentDate)),
      'Tareas obtenidas exitosamente',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una tarea por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 200, description: 'Tarea encontrada', type: ChoreResponseDto })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<ChoreResponseDto>> {
    const chore = await this.getChore.execute(id, payload.sub);
    return ApiResponseDto.ok(
      ChoreResponseDto.fromDomain(chore, todayInTimezone(timezone)),
      'Tarea obtenida exitosamente',
    );
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Listar los eventos (logs) de una tarea',
    description: 'Pagina con limit (default 20, max 100) y offset (default 0).',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs', type: [ChoreLogResponseDto] })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  async findLogs(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ApiResponseDto<ChoreLogResponseDto[]>> {
    const parsedLimit = parsePositiveInt(limit, LOGS_DEFAULT_LIMIT, 'limit');
    const parsedOffset = parseNonNegativeInt(offset, 0, 'offset');
    const cappedLimit = Math.min(parsedLimit, LOGS_MAX_LIMIT);

    const { data, total } = await this.listChoreLogs.execute(
      id,
      payload.sub,
      cappedLimit,
      parsedOffset,
    );
    const page = Math.floor(parsedOffset / cappedLimit) + 1;
    const totalPages = cappedLimit > 0 ? Math.ceil(total / cappedLimit) : 0;
    return ApiResponseDto.ok(
      data.map((l) => ChoreLogResponseDto.fromDomain(l)),
      'Eventos obtenidos exitosamente',
      { page, limit: cappedLimit, total, totalPages },
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una tarea recurrente',
    description: '`nextDueDate` se inicializa al `startDate`. `lastDoneDate` queda en null.',
  })
  @ApiResponse({ status: 201, description: 'Tarea creada', type: ChoreResponseDto })
  async create(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Body() dto: CreateChoreDto,
  ): Promise<ApiResponseDto<ChoreResponseDto>> {
    const chore = await this.createChore.execute(payload.sub, dto);
    return ApiResponseDto.ok(
      ChoreResponseDto.fromDomain(chore, todayInTimezone(timezone)),
      'Tarea creada exitosamente',
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar una tarea',
    description:
      'Permite modificar name, notes, category, intervalValue, intervalUnit y nextDueDate. ' +
      'Cambiar intervalValue/intervalUnit NO recalcula nextDueDate automáticamente — el usuario ' +
      'lo ajusta manualmente si lo desea.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 200, description: 'Tarea actualizada', type: ChoreResponseDto })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
    @Body() dto: UpdateChoreDto,
  ): Promise<ApiResponseDto<ChoreResponseDto>> {
    const chore = await this.updateChore.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      ChoreResponseDto.fromDomain(chore, todayInTimezone(timezone)),
      'Tarea actualizada exitosamente',
    );
  }

  @Post(':id/done')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Marcar una tarea como hecha',
    description:
      'Crea un log con doneAt (default = hoy en la timezone del cliente) y avanza nextDueDate ' +
      'a doneAt + intervalo. Setea lastDoneDate = doneAt.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({
    status: 201,
    description: 'Evento registrado. Retorna chore actualizado y log creado.',
  })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  async markDone(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
    @Body() dto: MarkChoreDoneDto,
  ): Promise<ApiResponseDto<{ chore: ChoreResponseDto; log: ChoreLogResponseDto }>> {
    const currentDate = todayInTimezone(timezone);
    const { chore, log } = await this.markChoreDone.execute(id, payload.sub, dto, currentDate);
    return ApiResponseDto.ok(
      {
        chore: ChoreResponseDto.fromDomain(chore, currentDate),
        log: ChoreLogResponseDto.fromDomain(log),
      },
      'Tarea marcada como hecha',
    );
  }

  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Saltear un ciclo de la tarea sin marcarla como hecha',
    description: 'Avanza nextDueDate += intervalo. No crea log, no toca lastDoneDate.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 200, description: 'Ciclo salteado', type: ChoreResponseDto })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  async skip(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
    @Body() _dto: SkipChoreDto,
  ): Promise<ApiResponseDto<ChoreResponseDto>> {
    const chore = await this.skipChoreCycle.execute(id, payload.sub);
    return ApiResponseDto.ok(
      ChoreResponseDto.fromDomain(chore, todayInTimezone(timezone)),
      'Ciclo salteado exitosamente',
    );
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archivar o desarchivar una tarea',
    description: 'Toggle de isActive. No afecta los logs históricos.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 200, description: 'Tarea archivada/desarchivada', type: ChoreResponseDto })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  async archive(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<ChoreResponseDto>> {
    const chore = await this.archiveChore.execute(id, payload.sub);
    return ApiResponseDto.ok(
      ChoreResponseDto.fromDomain(chore, todayInTimezone(timezone)),
      chore.isActive ? 'Tarea desarchivada exitosamente' : 'Tarea archivada exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar una tarea (soft delete condicional)',
    description:
      'Sólo permitido si la tarea no tiene logs. Si los tiene, archivala con PATCH /:id/archive.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 204, description: 'Tarea eliminada' })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  @ApiResponse({ status: 409, description: 'La tarea tiene eventos registrados' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteChore.execute(id, payload.sub);
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number, field: string): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} debe ser un entero positivo`);
  }
  return value;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number, field: string): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${field} debe ser un entero >= 0`);
  }
  return value;
}
