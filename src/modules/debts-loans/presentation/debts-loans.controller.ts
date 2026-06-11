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

import { BulkSettleByReferenceDto } from '../application/dto/bulk-settle-by-reference.dto';
import { BulkSettleResultDto } from '../application/dto/bulk-settle-result.dto';
import { CreateDebtLoanDto } from '../application/dto/create-debt-loan.dto';
import { DebtLoanResponseDto } from '../application/dto/debt-loan-response.dto';
import { DebtsSummaryResponseDto } from '../application/dto/debts-summary-response.dto';
import { GetDebtsQueryDto } from '../application/dto/get-debts-query.dto';
import { SettleDebtLoanDto } from '../application/dto/settle-debt-loan.dto';
import { UpdateDebtLoanDto } from '../application/dto/update-debt-loan.dto';
import { BulkSettleByReferenceUseCase } from '../application/use-cases/bulk-settle-by-reference.use-case';
import { CreateDebtLoanUseCase } from '../application/use-cases/create-debt-loan.use-case';
import { DeleteDebtLoanUseCase } from '../application/use-cases/delete-debt-loan.use-case';
import { GetDebtLoanUseCase } from '../application/use-cases/get-debt-loan.use-case';
import { GetDebtsSummaryUseCase } from '../application/use-cases/get-debts-summary.use-case';
import { ListDebtsLoansUseCase } from '../application/use-cases/list-debts-loans.use-case';
import { SettleDebtLoanUseCase } from '../application/use-cases/settle-debt-loan.use-case';
import { UpdateDebtLoanUseCase } from '../application/use-cases/update-debt-loan.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Debts and Loans')
@ApiBearerAuth()
@Controller('debts')
export class DebtsLoansController {
  constructor(
    private readonly listUseCase: ListDebtsLoansUseCase,
    private readonly getUseCase: GetDebtLoanUseCase,
    private readonly summaryUseCase: GetDebtsSummaryUseCase,
    private readonly createUseCase: CreateDebtLoanUseCase,
    private readonly updateUseCase: UpdateDebtLoanUseCase,
    private readonly deleteUseCase: DeleteDebtLoanUseCase,
    private readonly settleUseCase: SettleDebtLoanUseCase,
    private readonly bulkSettleUseCase: BulkSettleByReferenceUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar deudas y préstamos del usuario',
    description:
      'Devuelve rows del módulo nuevo `debts_loans` (no del legacy `transactions`). ' +
      'Filtra por status: `pending` (default), `settled`, o `all`.',
  })
  @ApiResponse({ status: 200, type: [DebtLoanResponseDto] })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetDebtsQueryDto,
  ): Promise<ApiResponseDto<DebtLoanResponseDto[]>> {
    const rows = await this.listUseCase.execute(user.sub, query.status);
    return ApiResponseDto.ok(
      rows.map((r) => DebtLoanResponseDto.fromDomain(r)),
      'Listado obtenido',
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen agregado por reference + currency',
    description:
      'Una row por `(LOWER(unaccent(reference)), currency)`. Replaza el viejo ' +
      '`/transactions/debts-summary` con la misma shape — el dashboard del web no cambia render.',
  })
  @ApiResponse({ status: 200, type: [DebtsSummaryResponseDto] })
  async summary(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetDebtsQueryDto,
  ): Promise<ApiResponseDto<DebtsSummaryResponseDto[]>> {
    const rows = await this.summaryUseCase.execute(user.sub, query.status);
    return ApiResponseDto.ok(rows, 'Resumen obtenido');
  }

  @Post('settle-by-reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liquidar en bulk todas las rows pendientes de una reference',
    description:
      'Real-payment (`currency` provided) mueve el pool por el delta neto. ' +
      'Informal-close (omitido) liquida todas las rows pendientes sin tocar pool.',
  })
  @ApiResponse({ status: 200, type: BulkSettleResultDto })
  async bulkSettleByReference(
    @CurrentUser() user: JwtPayload,
    @Body() body: BulkSettleByReferenceDto,
  ): Promise<ApiResponseDto<BulkSettleResultDto>> {
    const result = await this.bulkSettleUseCase.execute(user.sub, body);
    return ApiResponseDto.ok(result, 'Bulk settle aplicado');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una deuda/préstamo por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: DebtLoanResponseDto })
  @ApiResponse({ status: 404, description: 'DBT_001: deuda/préstamo no encontrado' })
  @ApiResponse({ status: 403, description: 'DBT_002: pertenece a otro usuario' })
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<DebtLoanResponseDto>> {
    const debt = await this.getUseCase.execute(id, user.sub);
    return ApiResponseDto.ok(DebtLoanResponseDto.fromDomain(debt), 'Obtenido');
  }

  @Post()
  @ApiOperation({
    summary: 'Crear una deuda o préstamo',
    description:
      'Crear es NEUTRAL en el pool — solo se mueve dinero cuando se settle en real-payment mode.',
  })
  @ApiResponse({ status: 201, type: DebtLoanResponseDto })
  @ApiResponse({ status: 422, description: 'DBT_003: reference requerida' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateDebtLoanDto,
  ): Promise<ApiResponseDto<DebtLoanResponseDto>> {
    const debt = await this.createUseCase.execute(user.sub, body);
    return ApiResponseDto.ok(DebtLoanResponseDto.fromDomain(debt), 'Creado');
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una deuda/préstamo',
    description:
      'En SETTLED solo se puede editar `amount` (y debe ser ≥ a lo ya liquidado). ' +
      'Subir el amount en una SETTLED reabre el row a PENDING.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: DebtLoanResponseDto })
  @ApiResponse({ status: 409, description: 'DBT_005: no se puede modificar (status SETTLED)' })
  @ApiResponse({ status: 422, description: 'DBT_007: amount menor a lo liquidado' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDebtLoanDto,
  ): Promise<ApiResponseDto<DebtLoanResponseDto>> {
    const updated = await this.updateUseCase.execute(id, user.sub, body);
    return ApiResponseDto.ok(DebtLoanResponseDto.fromDomain(updated), 'Actualizado');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete de una deuda/préstamo',
    description:
      'NO revierte deltas de pool previos. Si la row tuvo real-payment settles, ' +
      'esos movimientos quedan registrados en el pool.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Soft-deleted' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteUseCase.execute(id, user.sub);
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liquidar (parcial o total) una deuda/préstamo',
    description:
      'Con `currency` → real-payment (mueve el pool: DEBT debita, LOAN credita). ' +
      'Sin `currency` → informal-close (solo marca SETTLED).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: DebtLoanResponseDto })
  @ApiResponse({ status: 409, description: 'DBT_004: ya liquidada' })
  @ApiResponse({ status: 422, description: 'DBT_006: el monto excede el saldo pendiente' })
  async settle(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettleDebtLoanDto,
  ): Promise<ApiResponseDto<DebtLoanResponseDto>> {
    const settled = await this.settleUseCase.execute(id, user.sub, body);
    return ApiResponseDto.ok(DebtLoanResponseDto.fromDomain(settled), 'Liquidada');
  }
}
