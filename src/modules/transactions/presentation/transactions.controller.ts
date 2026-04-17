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

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { BulkSettleResponseDto } from '../application/dto/bulk-settle-response.dto';
import { CreateTransactionDto } from '../application/dto/create-transaction.dto';
import { DebtsSummaryResponseDto } from '../application/dto/debts-summary-response.dto';
import { GetDebtsSummaryQueryDto } from '../application/dto/get-debts-summary-query.dto';
import { GetTransactionsQueryDto } from '../application/dto/get-transactions-query.dto';
import { SettleByReferenceDto } from '../application/dto/settle-by-reference.dto';
import { SettleTransactionDto } from '../application/dto/settle-transaction.dto';
import { TransactionResponseDto } from '../application/dto/transaction-response.dto';
import { UpdateTransactionDto } from '../application/dto/update-transaction.dto';
import { BulkSettleByReferenceUseCase } from '../application/use-cases/bulk-settle-by-reference.use-case';
import { CreateTransactionUseCase } from '../application/use-cases/create-transaction.use-case';
import { DeleteTransactionUseCase } from '../application/use-cases/delete-transaction.use-case';
import { GetDebtsSummaryUseCase } from '../application/use-cases/get-debts-summary.use-case';
import { GetTransactionByIdUseCase } from '../application/use-cases/get-transaction-by-id.use-case';
import { GetTransactionsUseCase } from '../application/use-cases/get-transactions.use-case';
import { SettleTransactionUseCase } from '../application/use-cases/settle-transaction.use-case';
import { UpdateTransactionUseCase } from '../application/use-cases/update-transaction.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransactions: GetTransactionsUseCase,
    private readonly getTransactionById: GetTransactionByIdUseCase,
    private readonly updateTransaction: UpdateTransactionUseCase,
    private readonly deleteTransaction: DeleteTransactionUseCase,
    private readonly settleTransaction: SettleTransactionUseCase,
    private readonly getDebtsSummary: GetDebtsSummaryUseCase,
    private readonly bulkSettleByReference: BulkSettleByReferenceUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una nueva transacción',
    description:
      'Crea un INCOME, EXPENSE, TRANSFER, DEBT o LOAN. ' +
      'INCOME/EXPENSE/TRANSFER afectan el balance de la cuenta. ' +
      'DEBT/LOAN no afectan balance y requieren el campo `reference`. ' +
      'TRANSFER requiere `destinationAccountId` y ambas cuentas deben compartir moneda.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transacción creada exitosamente',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Cuenta origen o destino no encontrada' })
  @ApiResponse({
    status: 422,
    description: 'Validación de dominio: monedas distintas, misma cuenta, falta reference, etc.',
  })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateTransactionDto,
  ): Promise<ApiResponseDto<TransactionResponseDto>> {
    const tx = await this.createTransaction.execute(payload.sub, dto);
    return ApiResponseDto.ok(
      TransactionResponseDto.fromDomain(tx),
      'Transacción creada exitosamente',
    );
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Liquidar parcial o totalmente una deuda/préstamo',
    description:
      'Crea una transacción de liquidación vinculada a la deuda/préstamo original. ' +
      'DEBT → genera un EXPENSE (pago de deuda). LOAN → genera un INCOME (cobro de préstamo). ' +
      'El monto debe ser ≤ remainingAmount. Al liquidar completamente, el status cambia a SETTLED.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la transacción DEBT/LOAN a liquidar',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 201,
    description: 'Liquidación creada. Retorna la transacción de liquidación (EXPENSE o INCOME)',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transacción o cuenta no encontrada' })
  @ApiResponse({ status: 409, description: 'La deuda/préstamo ya fue liquidada completamente' })
  @ApiResponse({ status: 422, description: 'No es DEBT/LOAN, o monto excede saldo pendiente' })
  async settle(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SettleTransactionDto,
  ): Promise<ApiResponseDto<TransactionResponseDto>> {
    const settlement = await this.settleTransaction.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      TransactionResponseDto.fromDomain(settlement),
      'Liquidación registrada exitosamente',
    );
  }

  @Post('settle-by-reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liquidar en bloque todas las deudas/préstamos pendientes por referencia',
    description:
      'Marca como SETTLED todas las DEBT/LOAN pendientes cuya `reference` matchee la provista ' +
      '(LOWER + unaccent). NO crea transacciones de liquidación (EXPENSE/INCOME) ni afecta ' +
      'balances — cierra el libro cuando ya arreglaste informalmente. Para liquidar con efecto ' +
      'contable, usá POST /transactions/:id/settle. Idempotente: retorna count=0 si no hay ' +
      'pendientes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de la operación',
    type: BulkSettleResponseDto,
  })
  async settleByReference(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: SettleByReferenceDto,
  ): Promise<ApiResponseDto<BulkSettleResponseDto>> {
    const result = await this.bulkSettleByReference.execute(payload.sub, dto.reference);
    return ApiResponseDto.ok(result, 'Liquidación en bloque completada');
  }

  @Get()
  @ApiOperation({
    summary: 'Listar transacciones del usuario con filtros opcionales',
    description:
      'Retorna transacciones paginadas y ordenadas por fecha descendente. ' +
      'Soporta filtros por cuenta, categoría, tipo, status y rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de transacciones',
    type: [TransactionResponseDto],
  })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetTransactionsQueryDto,
  ): Promise<ApiResponseDto<TransactionResponseDto[]>> {
    const { items, meta } = await this.getTransactions.execute(payload.sub, query);
    return ApiResponseDto.ok(
      items.map(TransactionResponseDto.fromDomain.bind(TransactionResponseDto)),
      'Transacciones obtenidas exitosamente',
      meta,
    );
  }

  @Get('debts-summary')
  @ApiOperation({
    summary: 'Resumen de deudas/préstamos agrupado por referencia (persona)',
    description:
      'Agrupa transacciones DEBT/LOAN por referencia normalizada (case + accent insensitive). ' +
      'Devuelve los saldos pendientes (`pendingDebt`, `pendingLoan`) y el neto (`netOwed`). ' +
      'Por defecto (status=pending) solo incluye referencias con al menos una transacción ' +
      'pendiente. Usar ?status=all para incluir liquidadas; ?status=settled para solo ' +
      'referencias ya saldadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen ordenado por pendingLoan DESC, luego pendingDebt DESC',
    type: [DebtsSummaryResponseDto],
  })
  async findDebtsSummary(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetDebtsSummaryQueryDto,
  ): Promise<ApiResponseDto<DebtsSummaryResponseDto[]>> {
    const summary = await this.getDebtsSummary.execute(payload.sub, query.status);
    return ApiResponseDto.ok(summary, 'Resumen obtenido exitosamente');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una transacción por ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID de la transacción',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Transacción encontrada', type: TransactionResponseDto })
  @ApiResponse({ status: 403, description: 'La transacción pertenece a otro usuario' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<TransactionResponseDto>> {
    const tx = await this.getTransactionById.execute(id, payload.sub);
    return ApiResponseDto.ok(
      TransactionResponseDto.fromDomain(tx),
      'Transacción obtenida exitosamente',
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una transacción',
    description:
      'Actualiza campos editables: monto, descripción, categoría, fecha, reference. ' +
      'El tipo no es editable. Si se cambia el monto, el balance de la cuenta se recalcula automáticamente. ' +
      'Las transacciones DEBT/LOAN con status=SETTLED no se pueden modificar.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la transacción',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transacción actualizada',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'No se puede modificar una transacción ya liquidada (SETTLED)',
  })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<ApiResponseDto<TransactionResponseDto>> {
    const tx = await this.updateTransaction.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      TransactionResponseDto.fromDomain(tx),
      'Transacción actualizada exitosamente',
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una transacción (soft delete)',
    description:
      'Eliminación lógica que revierte el efecto en balance de la cuenta. ' +
      'Si es DEBT/LOAN, también elimina todas las liquidaciones asociadas y revierte sus balances. ' +
      'Si es una liquidación, revierte el remainingAmount de la deuda/préstamo original.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la transacción',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Transacción eliminada' })
  @ApiResponse({ status: 403, description: 'La transacción pertenece a otro usuario' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  async remove(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<null>> {
    await this.deleteTransaction.execute(id, payload.sub);
    return ApiResponseDto.ok(null, 'Transacción eliminada exitosamente');
  }
}
