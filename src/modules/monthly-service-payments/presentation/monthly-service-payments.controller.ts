import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { CreateMonthlyServicePaymentDto } from '../application/dto/create-monthly-service-payment.dto';
import { GetMonthlyServicePaymentsQueryDto } from '../application/dto/get-monthly-service-payments-query.dto';
import { MonthlyServicePaymentResponseDto } from '../application/dto/monthly-service-payment-response.dto';
import { UpdateMonthlyServicePaymentDto } from '../application/dto/update-monthly-service-payment.dto';
import { CreateMonthlyServicePaymentUseCase } from '../application/use-cases/create-monthly-service-payment.use-case';
import { DeleteMonthlyServicePaymentUseCase } from '../application/use-cases/delete-monthly-service-payment.use-case';
import { GetMonthlyServicePaymentUseCase } from '../application/use-cases/get-monthly-service-payment.use-case';
import { ListMonthlyServicePaymentsUseCase } from '../application/use-cases/list-monthly-service-payments.use-case';
import { UpdateMonthlyServicePaymentUseCase } from '../application/use-cases/update-monthly-service-payment.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Monthly Service Payments')
@ApiBearerAuth()
@Controller('monthly-service-payments')
export class MonthlyServicePaymentsController {
  constructor(
    private readonly listUseCase: ListMonthlyServicePaymentsUseCase,
    private readonly getUseCase: GetMonthlyServicePaymentUseCase,
    private readonly createUseCase: CreateMonthlyServicePaymentUseCase,
    private readonly updateUseCase: UpdateMonthlyServicePaymentUseCase,
    private readonly deleteUseCase: DeleteMonthlyServicePaymentUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los pagos de un servicio mensual',
    description: 'Filtra por `monthlyServiceId` (obligatorio). Ordenados por período desc.',
  })
  @ApiResponse({ status: 200, type: [MonthlyServicePaymentResponseDto] })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetMonthlyServicePaymentsQueryDto,
  ): Promise<ApiResponseDto<MonthlyServicePaymentResponseDto[]>> {
    const rows = await this.listUseCase.execute(user.sub, query.monthlyServiceId);
    return ApiResponseDto.ok(
      rows.map((r) => MonthlyServicePaymentResponseDto.fromDomain(r)),
      'Listado obtenido',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un pago por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: MonthlyServicePaymentResponseDto })
  @ApiResponse({ status: 404, description: 'MSP_001: pago no encontrado' })
  @ApiResponse({ status: 403, description: 'MSP_002: pertenece a otro usuario' })
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<MonthlyServicePaymentResponseDto>> {
    const payment = await this.getUseCase.execute(id, user.sub);
    return ApiResponseDto.ok(MonthlyServicePaymentResponseDto.fromDomain(payment), 'Obtenido');
  }

  @Post()
  @ApiOperation({
    summary: 'Registra un pago de servicio mensual para un período',
    description:
      'DEBITA el currency pool del user por `amount`. Currency se hereda del servicio. ' +
      '`period` (`YYYY-MM`) es explícito — se puede back-pay o pay-ahead. La combinación ' +
      '`(monthlyServiceId, period)` es única entre rows activas.',
  })
  @ApiResponse({ status: 201, type: MonthlyServicePaymentResponseDto })
  @ApiResponse({ status: 409, description: 'MSP_003: ya hay un pago para ese período' })
  @ApiResponse({ status: 422, description: 'MSP_005: período mal formado' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateMonthlyServicePaymentDto,
  ): Promise<ApiResponseDto<MonthlyServicePaymentResponseDto>> {
    const payment = await this.createUseCase.execute(user.sub, body);
    return ApiResponseDto.ok(
      MonthlyServicePaymentResponseDto.fromDomain(payment),
      'Pago registrado',
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualiza un pago (amount / date / description)',
    description:
      '`monthlyServiceId`, `currency`, y `period` son inmutables. Si cambia el ' +
      'amount, el pool ajusta la diferencia en una sola tx.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: MonthlyServicePaymentResponseDto })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMonthlyServicePaymentDto,
  ): Promise<ApiResponseDto<MonthlyServicePaymentResponseDto>> {
    const updated = await this.updateUseCase.execute(id, user.sub, body);
    return ApiResponseDto.ok(MonthlyServicePaymentResponseDto.fromDomain(updated), 'Actualizado');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-deletea un pago y REVIERTE el pool',
    description: 'Mismo comportamiento que DELETE /budget-movements/:id — el gasto se "deshace".',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Soft-deleted + refund aplicado' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteUseCase.execute(id, user.sub);
  }
}
