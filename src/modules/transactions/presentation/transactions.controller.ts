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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { CreateTransactionDto } from '../application/dto/create-transaction.dto';
import { GetTransactionsQueryDto } from '../application/dto/get-transactions-query.dto';
import { TransactionResponseDto } from '../application/dto/transaction-response.dto';
import { UpdateTransactionDto } from '../application/dto/update-transaction.dto';
import { CreateTransactionUseCase } from '../application/use-cases/create-transaction.use-case';
import { DeleteTransactionUseCase } from '../application/use-cases/delete-transaction.use-case';
import { GetTransactionByIdUseCase } from '../application/use-cases/get-transaction-by-id.use-case';
import { GetTransactionsUseCase } from '../application/use-cases/get-transactions.use-case';
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
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una nueva transacción' })
  @ApiResponse({ status: 201, description: 'Transacción creada', type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  @ApiResponse({ status: 422, description: 'Error de validación de dominio' })
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

  @Get()
  @ApiOperation({ summary: 'Listar transacciones del usuario con filtros opcionales' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones',
    type: [TransactionResponseDto],
  })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetTransactionsQueryDto,
  ): Promise<ApiResponseDto<TransactionResponseDto[]>> {
    const transactions = await this.getTransactions.execute(payload.sub, query);
    return ApiResponseDto.ok(
      transactions.map(TransactionResponseDto.fromDomain.bind(TransactionResponseDto)),
      'Transacciones obtenidas exitosamente',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una transacción por ID' })
  @ApiResponse({
    status: 200,
    description: 'Transacción encontrada',
    type: TransactionResponseDto,
  })
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
  @ApiOperation({ summary: 'Actualizar una transacción (monto, descripción, categoría, fecha)' })
  @ApiResponse({
    status: 200,
    description: 'Transacción actualizada',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una transacción (soft delete, revierte el balance)' })
  @ApiResponse({ status: 204, description: 'Transacción eliminada' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteTransaction.execute(id, payload.sub);
  }
}
