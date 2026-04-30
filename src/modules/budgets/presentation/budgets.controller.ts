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
import { Currency } from '@modules/accounts/domain/enums/currency.enum';
import { TransactionResponseDto } from '@modules/transactions/application/dto/transaction-response.dto';

import { AddBudgetMovementDto } from '../application/dto/add-budget-movement.dto';
import { BudgetResponseDto } from '../application/dto/budget-response.dto';
import { BudgetWithKpiResponseDto } from '../application/dto/budget-with-kpi-response.dto';
import { CreateBudgetDto } from '../application/dto/create-budget.dto';
import { UpdateBudgetDto } from '../application/dto/update-budget.dto';
import { AddBudgetMovementUseCase } from '../application/use-cases/add-budget-movement.use-case';
import { CreateBudgetUseCase } from '../application/use-cases/create-budget.use-case';
import { DeleteBudgetUseCase } from '../application/use-cases/delete-budget.use-case';
import { GetBudgetUseCase } from '../application/use-cases/get-budget.use-case';
import { GetCurrentBudgetUseCase } from '../application/use-cases/get-current-budget.use-case';
import { ListBudgetsUseCase } from '../application/use-cases/list-budgets.use-case';
import { UpdateBudgetUseCase } from '../application/use-cases/update-budget.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(
    private readonly listBudgets: ListBudgetsUseCase,
    private readonly getCurrentBudget: GetCurrentBudgetUseCase,
    private readonly getBudget: GetBudgetUseCase,
    private readonly createBudget: CreateBudgetUseCase,
    private readonly updateBudget: UpdateBudgetUseCase,
    private readonly deleteBudget: DeleteBudgetUseCase,
    private readonly addBudgetMovement: AddBudgetMovementUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todos los budgets del usuario (sin KPI)',
    description:
      'Vista de historial. Ordenado por (year, month) DESC y currency ASC. Sin KPI ni movimientos — la vista detalle se obtiene con GET /budgets/:id.',
  })
  @ApiResponse({ status: 200, description: 'Lista de budgets', type: [BudgetResponseDto] })
  async findAll(@CurrentUser() payload: JwtPayload): Promise<ApiResponseDto<BudgetResponseDto[]>> {
    const budgets = await this.listBudgets.execute(payload.sub);
    return ApiResponseDto.ok(
      budgets.map((b) => BudgetResponseDto.fromDomain(b)),
      'Budgets obtenidos exitosamente',
    );
  }

  @Get('current')
  @ApiOperation({
    summary: 'Obtener el budget del mes actual para una moneda + KPI + movimientos',
    description:
      'El mes se calcula en la timezone del cliente (header x-timezone). Si no existe budget, retorna data=null con status 200 (frontend renderiza CTA "crear budget").',
  })
  @ApiQuery({
    name: 'currency',
    required: true,
    enum: Currency,
    description: 'Moneda del budget a buscar (PEN, USD, ...).',
  })
  @ApiResponse({ status: 200, description: 'Budget + KPI o null si no existe' })
  async findCurrent(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Query('currency') currency: Currency,
  ): Promise<ApiResponseDto<BudgetWithKpiResponseDto | null>> {
    const result = await this.getCurrentBudget.execute(payload.sub, currency, timezone);
    if (!result) {
      return ApiResponseDto.ok(null, 'No hay budget para este mes y moneda');
    }
    return ApiResponseDto.ok(
      BudgetWithKpiResponseDto.fromDomain(result.budget, result.movements, result.kpi),
      'Budget actual obtenido exitosamente',
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un budget por ID + KPI + movimientos',
    description:
      'Funciona para budgets pasados, presentes o futuros. Para meses cerrados, daysRemainingIncludingToday=0 y dailyAllowance=null.',
  })
  @ApiParam({ name: 'id', description: 'UUID del budget' })
  @ApiResponse({ status: 200, description: 'Budget encontrado', type: BudgetWithKpiResponseDto })
  @ApiResponse({ status: 404, description: 'Budget no encontrado' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<BudgetWithKpiResponseDto>> {
    const result = await this.getBudget.execute(id, payload.sub, timezone);
    return ApiResponseDto.ok(
      BudgetWithKpiResponseDto.fromDomain(result.budget, result.movements, result.kpi),
      'Budget obtenido exitosamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un budget',
    description:
      'year y month son opcionales — si se omiten se usa el mes actual en la timezone del cliente. currency es inmutable después de crear.',
  })
  @ApiResponse({ status: 201, description: 'Budget creado', type: BudgetResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un budget para esa combinación (year, month, currency)',
  })
  async create(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Body() dto: CreateBudgetDto,
  ): Promise<ApiResponseDto<BudgetResponseDto>> {
    const budget = await this.createBudget.execute(payload.sub, dto, timezone);
    return ApiResponseDto.ok(BudgetResponseDto.fromDomain(budget), 'Budget creado exitosamente');
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar el monto de un budget',
    description:
      'Único campo editable: amount. year/month/currency son inmutables — si querés cambiar el período, eliminá y re-crea.',
  })
  @ApiParam({ name: 'id', description: 'UUID del budget' })
  @ApiResponse({ status: 200, description: 'Budget actualizado', type: BudgetResponseDto })
  @ApiResponse({ status: 404, description: 'Budget no encontrado' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<ApiResponseDto<BudgetResponseDto>> {
    const budget = await this.updateBudget.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      BudgetResponseDto.fromDomain(budget),
      'Budget actualizado exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un budget (soft delete)',
    description:
      'Marca deletedAt=now y nullea budgetId en todas las transactions linkeadas. Las transactions sobreviven como gastos normales — el dinero ya se movió.',
  })
  @ApiParam({ name: 'id', description: 'UUID del budget' })
  @ApiResponse({ status: 204, description: 'Budget eliminado' })
  @ApiResponse({ status: 404, description: 'Budget no encontrado' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteBudget.execute(id, payload.sub);
  }

  @Post(':id/movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un movimiento del budget',
    description:
      'Crea una transacción EXPENSE linkeada al budget (budgetId), debita la cuenta. Validaciones: cuenta del usuario en la moneda del budget, categoría del usuario, fecha dentro del mes del budget.',
  })
  @ApiParam({ name: 'id', description: 'UUID del budget' })
  @ApiResponse({
    status: 201,
    description: 'Movimiento registrado. Retorna la transacción creada.',
  })
  @ApiResponse({ status: 404, description: 'Budget, cuenta o categoría no encontrados' })
  @ApiResponse({
    status: 422,
    description: 'Currency mismatch o fecha fuera del mes del budget',
  })
  async addMovement(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddBudgetMovementDto,
  ): Promise<ApiResponseDto<{ transaction: TransactionResponseDto }>> {
    const { transaction } = await this.addBudgetMovement.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      { transaction: TransactionResponseDto.fromDomain(transaction) },
      'Movimiento registrado exitosamente',
    );
  }
}
