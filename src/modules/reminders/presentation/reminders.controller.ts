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

import { CreateReminderDto } from '../application/dto/create-reminder.dto';
import { ReminderResponseDto } from '../application/dto/reminder-response.dto';
import { UpdateReminderDto } from '../application/dto/update-reminder.dto';
import { CreateReminderUseCase } from '../application/use-cases/create-reminder.use-case';
import { DeleteReminderUseCase } from '../application/use-cases/delete-reminder.use-case';
import { GetRemindersUseCase } from '../application/use-cases/get-reminders.use-case';
import { UpdateReminderUseCase } from '../application/use-cases/update-reminder.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Reminders')
@ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly getReminders: GetRemindersUseCase,
    private readonly createReminder: CreateReminderUseCase,
    private readonly updateReminder: UpdateReminderUseCase,
    private readonly deleteReminder: DeleteReminderUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar recordatorios del usuario',
    description:
      'Ordenados por accionabilidad: pendientes antes que completados, después por ' +
      '`remindDate` ascendente (los sin fecha al final) y finalmente por `createdAt`. ' +
      'No hay cleanup automático — un recordatorio completado se queda hasta que lo borres.',
  })
  @ApiResponse({ status: 200, type: [ReminderResponseDto] })
  async findAll(
    @CurrentUser() payload: JwtPayload,
  ): Promise<ApiResponseDto<ReminderResponseDto[]>> {
    const reminders = await this.getReminders.execute(payload.sub);
    return ApiResponseDto.ok(
      reminders.map((r) => ReminderResponseDto.fromDomain(r)),
      'Recordatorios obtenidos exitosamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un recordatorio',
    description:
      'Fecha y hora son ambas opcionales. Sin fecha es una nota suelta que se lista pero ' +
      'nunca alerta. Una hora sin fecha es inválida (RMDR_008).',
  })
  @ApiResponse({ status: 201, type: ReminderResponseDto })
  @ApiResponse({ status: 422, description: 'Título vacío, o hora sin fecha' })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateReminderDto,
  ): Promise<ApiResponseDto<ReminderResponseDto>> {
    const reminder = await this.createReminder.execute(payload.sub, dto);
    return ApiResponseDto.ok(
      ReminderResponseDto.fromDomain(reminder),
      'Recordatorio creado exitosamente',
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un recordatorio',
    description:
      'Mandar `remindDate: null` borra la fecha y, con ella, la hora — una hora huérfana ' +
      'no es un estado alcanzable. Togglear `completed` sella o limpia `completedAt`.',
  })
  @ApiParam({ name: 'id', description: 'UUID del recordatorio' })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  @ApiResponse({ status: 404, description: 'Recordatorio no encontrado' })
  @ApiResponse({ status: 403, description: 'El recordatorio pertenece a otro usuario' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ): Promise<ApiResponseDto<ReminderResponseDto>> {
    const reminder = await this.updateReminder.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      ReminderResponseDto.fromDomain(reminder),
      'Recordatorio actualizado exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un recordatorio' })
  @ApiParam({ name: 'id', description: 'UUID del recordatorio' })
  @ApiResponse({ status: 204, description: 'Recordatorio eliminado' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteReminder.execute(id, payload.sub);
  }
}
