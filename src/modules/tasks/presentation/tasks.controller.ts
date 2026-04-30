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

import { CreateTaskDto } from '../application/dto/create-task.dto';
import { ReorderTasksDto } from '../application/dto/reorder-tasks.dto';
import { TaskResponseDto } from '../application/dto/task-response.dto';
import { UpdateTaskDto } from '../application/dto/update-task.dto';
import { CreateTaskUseCase } from '../application/use-cases/create-task.use-case';
import { DeleteTaskUseCase } from '../application/use-cases/delete-task.use-case';
import { ListTasksUseCase } from '../application/use-cases/list-tasks.use-case';
import { ReorderTasksUseCase } from '../application/use-cases/reorder-tasks.use-case';
import { UpdateTaskUseCase } from '../application/use-cases/update-task.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly listTasks: ListTasksUseCase,
    private readonly createTask: CreateTaskUseCase,
    private readonly updateTask: UpdateTaskUseCase,
    private readonly deleteTask: DeleteTaskUseCase,
    private readonly reorderTasks: ReorderTasksUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar tasks del usuario (con cleanup semanal lazy)',
    description:
      'Antes de devolver, se hard-deletean tasks completadas con `completedAt < startOfWeek` (en TZ + setting `startOfWeek` del usuario). Tasks incompletas sobreviven entre semanas. Resultado ordenado por (sectionPosition, taskPosition, createdAt).',
  })
  @ApiResponse({ status: 200, description: 'Lista de tasks', type: [TaskResponseDto] })
  async findAll(@CurrentUser() payload: JwtPayload): Promise<ApiResponseDto<TaskResponseDto[]>> {
    const tasks = await this.listTasks.execute(payload.sub);
    return ApiResponseDto.ok(
      tasks.map((t) => TaskResponseDto.fromDomain(t)),
      'Tasks obtenidas exitosamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear task dentro de una sección',
    description:
      'La sección debe pertenecer al usuario. La task se agrega al final del orden de la sección.',
  })
  @ApiResponse({ status: 201, description: 'Task creada', type: TaskResponseDto })
  @ApiResponse({ status: 404, description: 'Sección no encontrada' })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateTaskDto,
  ): Promise<ApiResponseDto<TaskResponseDto>> {
    const task = await this.createTask.execute(payload.sub, dto);
    return ApiResponseDto.ok(TaskResponseDto.fromDomain(task), 'Task creada exitosamente');
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reordenar tasks dentro de una sección',
    description:
      'Body: `{ sectionId, orderedIds }`. La drag-and-drop está restringida a la misma sección — para mover una task entre secciones, usá `PATCH /tasks/:id` con un nuevo `sectionId`.',
  })
  @ApiResponse({ status: 204, description: 'Reordenamiento aplicado' })
  @ApiResponse({
    status: 422,
    description: 'Algún ID no existe, no pertenece al usuario, o no está en la sección indicada',
  })
  async reorder(@CurrentUser() payload: JwtPayload, @Body() dto: ReorderTasksDto): Promise<void> {
    await this.reorderTasks.execute(payload.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar task',
    description:
      'Edita `title`, `description`, `completed` (toggle setea/limpia `completedAt` automáticamente), o `sectionId` (cross-section move — la task va al final de la nueva sección).',
  })
  @ApiParam({ name: 'id', description: 'UUID de la task' })
  @ApiResponse({ status: 200, description: 'Task actualizada', type: TaskResponseDto })
  @ApiResponse({ status: 404, description: 'Task o sección de destino no encontradas' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<ApiResponseDto<TaskResponseDto>> {
    const task = await this.updateTask.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(TaskResponseDto.fromDomain(task), 'Task actualizada exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar task (hard delete)' })
  @ApiParam({ name: 'id', description: 'UUID de la task' })
  @ApiResponse({ status: 204, description: 'Task eliminada' })
  @ApiResponse({ status: 404, description: 'Task no encontrada' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteTask.execute(id, payload.sub);
  }
}
