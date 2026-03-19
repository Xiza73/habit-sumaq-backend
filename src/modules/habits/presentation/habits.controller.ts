import {
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ClientTimezone } from '@common/decorators/client-timezone.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { CreateHabitDto } from '../application/dto/create-habit.dto';
import { GetDailyQueryDto } from '../application/dto/get-daily-query.dto';
import { GetHabitLogsQueryDto } from '../application/dto/get-habit-logs-query.dto';
import { GetHabitsQueryDto } from '../application/dto/get-habits-query.dto';
import { HabitLogResponseDto } from '../application/dto/habit-log-response.dto';
import { HabitResponseDto } from '../application/dto/habit-response.dto';
import { LogHabitDto } from '../application/dto/log-habit.dto';
import { UpdateHabitDto } from '../application/dto/update-habit.dto';
import { ArchiveHabitUseCase } from '../application/use-cases/archive-habit.use-case';
import { CreateHabitUseCase } from '../application/use-cases/create-habit.use-case';
import { DeleteHabitUseCase } from '../application/use-cases/delete-habit.use-case';
import { GetDailySummaryUseCase } from '../application/use-cases/get-daily-summary.use-case';
import { GetHabitByIdUseCase } from '../application/use-cases/get-habit-by-id.use-case';
import { GetHabitLogsUseCase } from '../application/use-cases/get-habit-logs.use-case';
import { GetHabitsUseCase } from '../application/use-cases/get-habits.use-case';
import { LogHabitUseCase } from '../application/use-cases/log-habit.use-case';
import { UpdateHabitUseCase } from '../application/use-cases/update-habit.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Habits')
@ApiBearerAuth()
@Controller('habits')
export class HabitsController {
  constructor(
    private readonly createHabit: CreateHabitUseCase,
    private readonly getHabits: GetHabitsUseCase,
    private readonly getHabitById: GetHabitByIdUseCase,
    private readonly updateHabit: UpdateHabitUseCase,
    private readonly archiveHabit: ArchiveHabitUseCase,
    private readonly deleteHabit: DeleteHabitUseCase,
    private readonly logHabit: LogHabitUseCase,
    private readonly getHabitLogs: GetHabitLogsUseCase,
    private readonly getDailySummary: GetDailySummaryUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo hábito',
    description:
      'Crea un hábito con frecuencia diaria o semanal. El nombre debe ser único por usuario.',
  })
  @ApiResponse({ status: 201, description: 'Hábito creado exitosamente', type: HabitResponseDto })
  @ApiResponse({ status: 409, description: 'Ya existe un hábito con ese nombre' })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateHabitDto,
  ): Promise<ApiResponseDto<HabitResponseDto>> {
    const habit = await this.createHabit.execute(payload.sub, dto);
    return ApiResponseDto.ok(HabitResponseDto.fromDomain(habit), 'Hábito creado exitosamente');
  }

  @Get()
  @ApiOperation({
    summary: 'Listar hábitos del usuario con estadísticas',
    description:
      'Retorna todos los hábitos activos con streak, completionRate y log de hoy. ' +
      'Usar ?includeArchived=true para incluir archivados.',
  })
  @ApiResponse({ status: 200, description: 'Lista de hábitos', type: [HabitResponseDto] })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetHabitsQueryDto,
    @ClientTimezone() timezone: string,
  ): Promise<ApiResponseDto<HabitResponseDto[]>> {
    const habits = await this.getHabits.execute(payload.sub, query, timezone);
    return ApiResponseDto.ok(habits, 'Hábitos obtenidos exitosamente');
  }

  @Get('daily')
  @ApiOperation({
    summary: 'Resumen diario de hábitos',
    description:
      'Retorna solo hábitos activos (no archivados) con su log y estadísticas. ' +
      'Usar ?date=YYYY-MM-DD para obtener el resumen de una fecha específica. ' +
      'Si se omite, usa la fecha actual.',
  })
  @ApiResponse({ status: 200, description: 'Resumen diario', type: [HabitResponseDto] })
  async daily(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetDailyQueryDto,
    @ClientTimezone() timezone: string,
  ): Promise<ApiResponseDto<HabitResponseDto[]>> {
    const habits = await this.getDailySummary.execute(payload.sub, timezone, query.date);
    return ApiResponseDto.ok(habits, 'Resumen diario obtenido exitosamente');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un hábito por ID con estadísticas' })
  @ApiParam({
    name: 'id',
    description: 'UUID del hábito',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Hábito encontrado', type: HabitResponseDto })
  @ApiResponse({ status: 403, description: 'El hábito pertenece a otro usuario' })
  @ApiResponse({ status: 404, description: 'Hábito no encontrado' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @ClientTimezone() timezone: string,
  ): Promise<ApiResponseDto<HabitResponseDto>> {
    const habit = await this.getHabitById.execute(id, payload.sub, timezone);
    return ApiResponseDto.ok(habit, 'Hábito obtenido exitosamente');
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un hábito',
    description: 'Solo se actualizan los campos enviados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del hábito',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Hábito actualizado', type: HabitResponseDto })
  @ApiResponse({ status: 404, description: 'Hábito no encontrado' })
  @ApiResponse({ status: 409, description: 'El nuevo nombre ya está en uso' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHabitDto,
  ): Promise<ApiResponseDto<HabitResponseDto>> {
    const habit = await this.updateHabit.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(HabitResponseDto.fromDomain(habit), 'Hábito actualizado exitosamente');
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archivar o desarchivar un hábito',
    description:
      'Alterna el estado de archivado. Un hábito archivado no aparece en el resumen diario.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del hábito',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de archivado actualizado',
    type: HabitResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Hábito no encontrado' })
  async archive(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<HabitResponseDto>> {
    const habit = await this.archiveHabit.execute(id, payload.sub);
    const message = habit.isArchived
      ? 'Hábito archivado exitosamente'
      : 'Hábito desarchivado exitosamente';
    return ApiResponseDto.ok(HabitResponseDto.fromDomain(habit), message);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un hábito (soft delete)',
    description: 'Elimina el hábito y todos sus logs asociados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del hábito',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Hábito eliminado' })
  @ApiResponse({ status: 404, description: 'Hábito no encontrado' })
  async remove(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<null>> {
    await this.deleteHabit.execute(id, payload.sub);
    return ApiResponseDto.ok(null, 'Hábito eliminado exitosamente');
  }

  @Post(':id/logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar el log de un hábito',
    description:
      'Si ya existe un log para el hábito en la fecha indicada, lo actualiza. ' +
      'No se permite registrar logs en fechas futuras ni en hábitos archivados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del hábito',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 201,
    description: 'Log registrado exitosamente',
    type: HabitLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Hábito no encontrado' })
  @ApiResponse({ status: 422, description: 'Hábito archivado o fecha futura' })
  async log(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: LogHabitDto,
    @ClientTimezone() timezone: string,
  ): Promise<ApiResponseDto<HabitLogResponseDto>> {
    const habitLog = await this.logHabit.execute(id, payload.sub, dto, timezone);
    return ApiResponseDto.ok(
      HabitLogResponseDto.fromDomain(habitLog),
      'Log registrado exitosamente',
    );
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Obtener historial de logs de un hábito',
    description: 'Retorna logs paginados con filtros opcionales por rango de fechas.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del hábito',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Historial de logs', type: [HabitLogResponseDto] })
  @ApiResponse({ status: 404, description: 'Hábito no encontrado' })
  async findLogs(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Query() query: GetHabitLogsQueryDto,
  ): Promise<ApiResponseDto<HabitLogResponseDto[]>> {
    const { data, total } = await this.getHabitLogs.execute(id, payload.sub, query);
    const totalPages = Math.ceil(total / query.limit);
    return ApiResponseDto.ok(
      data.map(HabitLogResponseDto.fromDomain.bind(HabitLogResponseDto)),
      'Logs obtenidos exitosamente',
      { page: query.page, limit: query.limit, total, totalPages },
    );
  }
}
