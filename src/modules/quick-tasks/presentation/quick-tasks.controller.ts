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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { CreateQuickTaskDto } from '../application/dto/create-quick-task.dto';
import { QuickTaskResponseDto } from '../application/dto/quick-task-response.dto';
import { ReorderQuickTasksDto } from '../application/dto/reorder-quick-tasks.dto';
import { UpdateQuickTaskDto } from '../application/dto/update-quick-task.dto';
import { CreateQuickTaskUseCase } from '../application/use-cases/create-quick-task.use-case';
import { DeleteQuickTaskUseCase } from '../application/use-cases/delete-quick-task.use-case';
import { GetQuickTasksUseCase } from '../application/use-cases/get-quick-tasks.use-case';
import { ReorderQuickTasksUseCase } from '../application/use-cases/reorder-quick-tasks.use-case';
import { UpdateQuickTaskUseCase } from '../application/use-cases/update-quick-task.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Quick Tasks')
@ApiBearerAuth()
@Controller('quick-tasks')
export class QuickTasksController {
  constructor(
    private readonly getQuickTasks: GetQuickTasksUseCase,
    private readonly createQuickTask: CreateQuickTaskUseCase,
    private readonly updateQuickTask: UpdateQuickTaskUseCase,
    private readonly deleteQuickTask: DeleteQuickTaskUseCase,
    private readonly reorderQuickTasks: ReorderQuickTasksUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar tareas diarias del usuario',
    description:
      'Antes de devolver, aplica un lazy cleanup: elimina las tareas completadas cuyo ' +
      '`completedAt` sea anterior al inicio del día en la zona horaria del usuario. ' +
      'Las pendientes persisten entre días.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista ordenada por position ASC',
    type: [QuickTaskResponseDto],
  })
  async findAll(
    @CurrentUser() payload: JwtPayload,
  ): Promise<ApiResponseDto<QuickTaskResponseDto[]>> {
    const tasks = await this.getQuickTasks.execute(payload.sub);
    return ApiResponseDto.ok(
      tasks.map((t) => QuickTaskResponseDto.fromDomain(t)),
      'Tareas obtenidas exitosamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una nueva tarea diaria',
    description: 'La nueva tarea se agrega al final (position = max + 1).',
  })
  @ApiResponse({ status: 201, description: 'Tarea creada', type: QuickTaskResponseDto })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateQuickTaskDto,
  ): Promise<ApiResponseDto<QuickTaskResponseDto>> {
    const task = await this.createQuickTask.execute(payload.sub, dto);
    return ApiResponseDto.ok(QuickTaskResponseDto.fromDomain(task), 'Tarea creada exitosamente');
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reordenar las tareas en bloque',
    description:
      'Reescribe la posición de cada id según su índice en `orderedIds` (1..N). ' +
      'Todas las ids deben pertenecer al usuario autenticado.',
  })
  @ApiResponse({ status: 204, description: 'Reordenamiento aplicado' })
  @ApiResponse({ status: 422, description: 'Algún id no pertenece al usuario' })
  async reorder(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ReorderQuickTasksDto,
  ): Promise<void> {
    await this.reorderQuickTasks.execute(payload.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una tarea (título, descripción, completado)',
    description:
      'Al togglear `completed` a true se setea `completedAt = now`. Al revertir a false ' +
      'se limpia `completedAt` — la tarea vuelve a sobrevivir al cleanup del día siguiente.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 200, description: 'Tarea actualizada', type: QuickTaskResponseDto })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  @ApiResponse({ status: 403, description: 'La tarea pertenece a otro usuario' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateQuickTaskDto,
  ): Promise<ApiResponseDto<QuickTaskResponseDto>> {
    const task = await this.updateQuickTask.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      QuickTaskResponseDto.fromDomain(task),
      'Tarea actualizada exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una tarea (hard delete)' })
  @ApiParam({ name: 'id', description: 'UUID de la tarea' })
  @ApiResponse({ status: 204, description: 'Tarea eliminada' })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  @ApiResponse({ status: 403, description: 'La tarea pertenece a otro usuario' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteQuickTask.execute(id, payload.sub);
  }
}
