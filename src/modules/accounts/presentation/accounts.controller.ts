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

import { AccountResponseDto } from '../application/dto/account-response.dto';
import { CreateAccountDto } from '../application/dto/create-account.dto';
import { GetAccountsQueryDto } from '../application/dto/get-accounts-query.dto';
import { UpdateAccountDto } from '../application/dto/update-account.dto';
import { ArchiveAccountUseCase } from '../application/use-cases/archive-account.use-case';
import { CreateAccountUseCase } from '../application/use-cases/create-account.use-case';
import { DeleteAccountUseCase } from '../application/use-cases/delete-account.use-case';
import { GetAccountByIdUseCase } from '../application/use-cases/get-account-by-id.use-case';
import { GetAccountsUseCase } from '../application/use-cases/get-accounts.use-case';
import { UpdateAccountUseCase } from '../application/use-cases/update-account.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly createAccount: CreateAccountUseCase,
    private readonly getAccounts: GetAccountsUseCase,
    private readonly getAccountById: GetAccountByIdUseCase,
    private readonly updateAccount: UpdateAccountUseCase,
    private readonly archiveAccount: ArchiveAccountUseCase,
    private readonly deleteAccount: DeleteAccountUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva cuenta financiera' })
  @ApiResponse({ status: 201, description: 'Cuenta creada', type: AccountResponseDto })
  @ApiResponse({ status: 409, description: 'Ya existe una cuenta con ese nombre' })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateAccountDto,
  ): Promise<ApiResponseDto<AccountResponseDto>> {
    const account = await this.createAccount.execute(payload.sub, dto);
    return ApiResponseDto.ok(AccountResponseDto.fromDomain(account), 'Cuenta creada exitosamente');
  }

  @Get()
  @ApiOperation({ summary: 'Listar cuentas del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de cuentas', type: [AccountResponseDto] })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetAccountsQueryDto,
  ): Promise<ApiResponseDto<AccountResponseDto[]>> {
    const accounts = await this.getAccounts.execute(payload.sub, query.includeArchived);
    return ApiResponseDto.ok(
      accounts.map(AccountResponseDto.fromDomain.bind(AccountResponseDto)),
      'Cuentas obtenidas exitosamente',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cuenta por ID' })
  @ApiResponse({ status: 200, description: 'Cuenta encontrada', type: AccountResponseDto })
  @ApiResponse({ status: 403, description: 'La cuenta pertenece a otro usuario' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<AccountResponseDto>> {
    const account = await this.getAccountById.execute(id, payload.sub);
    return ApiResponseDto.ok(
      AccountResponseDto.fromDomain(account),
      'Cuenta obtenida exitosamente',
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nombre, color e ícono de una cuenta' })
  @ApiResponse({ status: 200, description: 'Cuenta actualizada', type: AccountResponseDto })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  @ApiResponse({ status: 409, description: 'El nuevo nombre ya está en uso' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<ApiResponseDto<AccountResponseDto>> {
    const account = await this.updateAccount.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      AccountResponseDto.fromDomain(account),
      'Cuenta actualizada exitosamente',
    );
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archivar una cuenta (ocultar sin eliminar)' })
  @ApiResponse({ status: 200, description: 'Cuenta archivada', type: AccountResponseDto })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async archive(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<AccountResponseDto>> {
    const account = await this.archiveAccount.execute(id, payload.sub);
    return ApiResponseDto.ok(
      AccountResponseDto.fromDomain(account),
      'Cuenta archivada exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una cuenta (soft delete)' })
  @ApiResponse({ status: 204, description: 'Cuenta eliminada' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteAccount.execute(id, payload.sub);
  }
}
