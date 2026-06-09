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

import { BudgetMovementResponseDto } from '../application/dto/budget-movement-response.dto';
import { CreateBudgetMovementDto } from '../application/dto/create-budget-movement.dto';
import { GetBudgetMovementsQueryDto } from '../application/dto/get-budget-movements-query.dto';
import { UpdateBudgetMovementDto } from '../application/dto/update-budget-movement.dto';
import { CreateBudgetMovementUseCase } from '../application/use-cases/create-budget-movement.use-case';
import { DeleteBudgetMovementUseCase } from '../application/use-cases/delete-budget-movement.use-case';
import { GetBudgetMovementUseCase } from '../application/use-cases/get-budget-movement.use-case';
import { ListBudgetMovementsUseCase } from '../application/use-cases/list-budget-movements.use-case';
import { UpdateBudgetMovementUseCase } from '../application/use-cases/update-budget-movement.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Budget Movements')
@ApiBearerAuth()
@Controller('budget-movements')
export class BudgetMovementsController {
  constructor(
    private readonly listUseCase: ListBudgetMovementsUseCase,
    private readonly getUseCase: GetBudgetMovementUseCase,
    private readonly createUseCase: CreateBudgetMovementUseCase,
    private readonly updateUseCase: UpdateBudgetMovementUseCase,
    private readonly deleteUseCase: DeleteBudgetMovementUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista movimientos de un budget',
    description: 'Filtra por `budgetId` (obligatorio). Ordenados por fecha desc.',
  })
  @ApiResponse({ status: 200, type: [BudgetMovementResponseDto] })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetBudgetMovementsQueryDto,
  ): Promise<ApiResponseDto<BudgetMovementResponseDto[]>> {
    const rows = await this.listUseCase.execute(user.sub, query.budgetId);
    return ApiResponseDto.ok(
      rows.map((r) => BudgetMovementResponseDto.fromDomain(r)),
      'Listado obtenido',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un movimiento por id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BudgetMovementResponseDto })
  @ApiResponse({ status: 404, description: 'BMV_001: movimiento no encontrado' })
  @ApiResponse({ status: 403, description: 'BMV_002: pertenece a otro usuario' })
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<BudgetMovementResponseDto>> {
    const movement = await this.getUseCase.execute(id, user.sub);
    return ApiResponseDto.ok(BudgetMovementResponseDto.fromDomain(movement), 'Obtenido');
  }

  @Post()
  @ApiOperation({
    summary: 'Crea un movimiento contra un budget',
    description:
      'NEUTRAL para el budget mismo (la tabla no se toca), pero DEBITA el currency pool ' +
      'del user por el monto. La currency se hereda del budget — no se pasa en el DTO.',
  })
  @ApiResponse({ status: 201, type: BudgetMovementResponseDto })
  @ApiResponse({ status: 422, description: 'BMV_003: la fecha no cae dentro del budget' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateBudgetMovementDto,
  ): Promise<ApiResponseDto<BudgetMovementResponseDto>> {
    const movement = await this.createUseCase.execute(user.sub, body);
    return ApiResponseDto.ok(BudgetMovementResponseDto.fromDomain(movement), 'Creado');
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualiza un movimiento (amount / date / description / categoryId)',
    description:
      'Si cambia el amount, el pool ajusta la diferencia (oldAmount - newAmount) ' +
      'en una sola tx. budgetId y currency son inmutables.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BudgetMovementResponseDto })
  @ApiResponse({ status: 422, description: 'BMV_003: la nueva fecha no cae dentro del budget' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBudgetMovementDto,
  ): Promise<ApiResponseDto<BudgetMovementResponseDto>> {
    const updated = await this.updateUseCase.execute(id, user.sub, body);
    return ApiResponseDto.ok(BudgetMovementResponseDto.fromDomain(updated), 'Actualizado');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-deletea un movimiento y REVIERTE el pool',
    description:
      'A diferencia de DELETE /debts/:id (que no toca el pool), borrar un budget ' +
      'movement reembolsa al user el amount — el gasto se "deshace".',
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
