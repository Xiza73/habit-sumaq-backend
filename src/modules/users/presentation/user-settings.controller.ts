import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { UpdateUserSettingsDto } from '../application/dto/update-user-settings.dto';
import { UserSettingsResponseDto } from '../application/dto/user-settings-response.dto';
import { GetUserSettingsUseCase } from '../application/use-cases/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../application/use-cases/update-user-settings.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('User Settings')
@ApiBearerAuth()
@Controller('users/settings')
export class UserSettingsController {
  constructor(
    private readonly getUserSettings: GetUserSettingsUseCase,
    private readonly updateUserSettings: UpdateUserSettingsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener configuración del usuario',
    description:
      'Retorna la configuración del usuario autenticado. ' +
      'Si no existe, se crea automáticamente con valores por defecto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración del usuario',
    type: UserSettingsResponseDto,
  })
  async get(@CurrentUser() payload: JwtPayload): Promise<ApiResponseDto<UserSettingsResponseDto>> {
    const settings = await this.getUserSettings.execute(payload.sub);
    return ApiResponseDto.ok(
      UserSettingsResponseDto.fromDomain(settings),
      'Configuración obtenida',
    );
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar configuración del usuario',
    description:
      'Actualiza parcialmente la configuración. Solo se modifican los campos enviados. ' +
      'Si no existe configuración previa, se crea automáticamente antes de aplicar los cambios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada',
    type: UserSettingsResponseDto,
  })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUserSettingsDto,
  ): Promise<ApiResponseDto<UserSettingsResponseDto>> {
    const settings = await this.updateUserSettings.execute(payload.sub, dto);
    return ApiResponseDto.ok(
      UserSettingsResponseDto.fromDomain(settings),
      'Configuración actualizada',
    );
  }
}
