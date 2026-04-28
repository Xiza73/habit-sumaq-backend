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

import { TransactionResponseDto } from '../../transactions/application/dto/transaction-response.dto';
import { CreateMonthlyServiceDto } from '../application/dto/create-monthly-service.dto';
import { MonthlyServiceResponseDto } from '../application/dto/monthly-service-response.dto';
import { PayMonthlyServiceDto } from '../application/dto/pay-monthly-service.dto';
import { SkipMonthDto } from '../application/dto/skip-month.dto';
import { UpdateMonthlyServiceDto } from '../application/dto/update-monthly-service.dto';
import { ArchiveMonthlyServiceUseCase } from '../application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServicesUseCase } from '../application/use-cases/list-monthly-services.use-case';
import { PayMonthlyServiceUseCase } from '../application/use-cases/pay-monthly-service.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../application/use-cases/update-monthly-service.use-case';
import { currentPeriodInTimezone } from '../infrastructure/timezone/current-period-in-timezone';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Monthly Services')
@ApiBearerAuth()
@Controller('monthly-services')
export class MonthlyServicesController {
  constructor(
    private readonly listMonthlyServices: ListMonthlyServicesUseCase,
    private readonly getMonthlyService: GetMonthlyServiceUseCase,
    private readonly createMonthlyService: CreateMonthlyServiceUseCase,
    private readonly updateMonthlyService: UpdateMonthlyServiceUseCase,
    private readonly payMonthlyService: PayMonthlyServiceUseCase,
    private readonly skipMonthlyServiceMonth: SkipMonthlyServiceMonthUseCase,
    private readonly archiveMonthlyService: ArchiveMonthlyServiceUseCase,
    private readonly deleteMonthlyService: DeleteMonthlyServiceUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar servicios mensuales del usuario',
    description:
      'Retorna los servicios activos por defecto. Usa ?includeArchived=true para incluir ' +
      'también los archivados. Cada ítem incluye campos calculados: nextDuePeriod, isOverdue ' +
      'y isPaidForCurrentMonth (basados en la timezone del header x-timezone).',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Incluir servicios archivados (isActive=false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de servicios',
    type: [MonthlyServiceResponseDto],
  })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<ApiResponseDto<MonthlyServiceResponseDto[]>> {
    const includeArchivedFlag = includeArchived === 'true';
    const services = await this.listMonthlyServices.execute(payload.sub, includeArchivedFlag);
    const currentPeriod = currentPeriodInTimezone(timezone);
    return ApiResponseDto.ok(
      services.map((s) => MonthlyServiceResponseDto.fromDomain(s, currentPeriod)),
      'Servicios obtenidos exitosamente',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un servicio mensual por ID' })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio encontrado', type: MonthlyServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<MonthlyServiceResponseDto>> {
    const service = await this.getMonthlyService.execute(id, payload.sub);
    return ApiResponseDto.ok(
      MonthlyServiceResponseDto.fromDomain(service, currentPeriodInTimezone(timezone)),
      'Servicio obtenido exitosamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un servicio mensual',
    description:
      'La moneda debe coincidir con la cuenta por defecto. Si no se envía startPeriod se usa ' +
      'el mes actual en la timezone del cliente (header x-timezone).',
  })
  @ApiResponse({ status: 201, description: 'Servicio creado', type: MonthlyServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Cuenta o categoría no encontradas' })
  @ApiResponse({ status: 409, description: 'Ya tienes un servicio activo con ese nombre' })
  @ApiResponse({
    status: 422,
    description: 'La moneda del servicio no coincide con la de la cuenta',
  })
  async create(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Body() dto: CreateMonthlyServiceDto,
  ): Promise<ApiResponseDto<MonthlyServiceResponseDto>> {
    const service = await this.createMonthlyService.execute(payload.sub, dto, timezone);
    return ApiResponseDto.ok(
      MonthlyServiceResponseDto.fromDomain(service, currentPeriodInTimezone(timezone)),
      'Servicio creado exitosamente',
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar un servicio mensual',
    description:
      'Campos editables: name, defaultAccountId, categoryId, estimatedAmount, dueDay. ' +
      'currency y startPeriod son inmutables después de la creación.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Servicio actualizado',
    type: MonthlyServiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Servicio, cuenta o categoría no encontrados' })
  @ApiResponse({ status: 409, description: 'Ya tienes un servicio activo con ese nombre' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
    @Body() dto: UpdateMonthlyServiceDto,
  ): Promise<ApiResponseDto<MonthlyServiceResponseDto>> {
    const service = await this.updateMonthlyService.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      MonthlyServiceResponseDto.fromDomain(service, currentPeriodInTimezone(timezone)),
      'Servicio actualizado exitosamente',
    );
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un pago del servicio',
    description:
      'Crea una transacción EXPENSE vinculada al servicio, debita la cuenta de pago, avanza ' +
      'lastPaidPeriod al período facturado y recalcula estimatedAmount como promedio de las ' +
      'últimas 3 transacciones.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({
    status: 201,
    description: 'Pago registrado. Retorna el servicio actualizado y la transacción creada.',
  })
  @ApiResponse({ status: 404, description: 'Servicio o cuenta no encontrados' })
  @ApiResponse({
    status: 409,
    description: 'El servicio ya está pagado para el mes actual (idempotency guard)',
  })
  @ApiResponse({ status: 422, description: 'Monedas incompatibles' })
  async pay(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
    @Body() dto: PayMonthlyServiceDto,
  ): Promise<
    ApiResponseDto<{ service: MonthlyServiceResponseDto; transaction: TransactionResponseDto }>
  > {
    const currentPeriod = currentPeriodInTimezone(timezone);
    const { service, transaction } = await this.payMonthlyService.execute(
      id,
      payload.sub,
      dto,
      currentPeriod,
      timezone,
    );
    return ApiResponseDto.ok(
      {
        service: MonthlyServiceResponseDto.fromDomain(service, currentPeriod),
        transaction: TransactionResponseDto.fromDomain(transaction),
      },
      'Pago registrado exitosamente',
    );
  }

  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Saltear un mes del servicio sin crear transacción',
    description:
      'Avanza lastPaidPeriod al próximo período sin afectar balance. Útil para meses gratis ' +
      'o suspensiones temporales.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Mes salteado. Retorna el servicio actualizado.',
    type: MonthlyServiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  async skip(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
    @Body() dto: SkipMonthDto,
  ): Promise<ApiResponseDto<MonthlyServiceResponseDto>> {
    const service = await this.skipMonthlyServiceMonth.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      MonthlyServiceResponseDto.fromDomain(service, currentPeriodInTimezone(timezone)),
      'Mes salteado exitosamente',
    );
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archivar o desarchivar un servicio',
    description: 'Toggle de isActive. No afecta las transacciones históricas.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Servicio archivado/desarchivado',
    type: MonthlyServiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  async archive(
    @CurrentUser() payload: JwtPayload,
    @ClientTimezone() timezone: string,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<MonthlyServiceResponseDto>> {
    const service = await this.archiveMonthlyService.execute(id, payload.sub);
    return ApiResponseDto.ok(
      MonthlyServiceResponseDto.fromDomain(service, currentPeriodInTimezone(timezone)),
      service.isActive ? 'Servicio desarchivado exitosamente' : 'Servicio archivado exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un servicio (soft delete condicional)',
    description:
      'Sólo permitido si el servicio no tiene pagos registrados (marca deletedAt=now). ' +
      'Si los tiene, archivalo en su lugar con PATCH /:id/archive.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio' })
  @ApiResponse({ status: 204, description: 'Servicio eliminado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El servicio tiene pagos registrados y no puede eliminarse',
  })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteMonthlyService.execute(id, payload.sub);
  }
}
