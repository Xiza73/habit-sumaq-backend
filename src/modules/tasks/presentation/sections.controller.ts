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

import { CreateSectionDto } from '../application/dto/create-section.dto';
import { ReorderSectionsDto } from '../application/dto/reorder-sections.dto';
import { SectionResponseDto } from '../application/dto/section-response.dto';
import { UpdateSectionDto } from '../application/dto/update-section.dto';
import { CreateSectionUseCase } from '../application/use-cases/create-section.use-case';
import { DeleteSectionUseCase } from '../application/use-cases/delete-section.use-case';
import { ListSectionsUseCase } from '../application/use-cases/list-sections.use-case';
import { ReorderSectionsUseCase } from '../application/use-cases/reorder-sections.use-case';
import { UpdateSectionUseCase } from '../application/use-cases/update-section.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Tasks › Sections')
@ApiBearerAuth()
@Controller('tasks/sections')
export class SectionsController {
  constructor(
    private readonly listSections: ListSectionsUseCase,
    private readonly createSection: CreateSectionUseCase,
    private readonly updateSection: UpdateSectionUseCase,
    private readonly deleteSection: DeleteSectionUseCase,
    private readonly reorderSections: ReorderSectionsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar secciones del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de secciones', type: [SectionResponseDto] })
  async findAll(@CurrentUser() payload: JwtPayload): Promise<ApiResponseDto<SectionResponseDto[]>> {
    const sections = await this.listSections.execute(payload.sub);
    return ApiResponseDto.ok(
      sections.map((s) => SectionResponseDto.fromDomain(s)),
      'Secciones obtenidas exitosamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear sección',
    description: 'Se agrega al final del orden actual del usuario.',
  })
  @ApiResponse({ status: 201, description: 'Sección creada', type: SectionResponseDto })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateSectionDto,
  ): Promise<ApiResponseDto<SectionResponseDto>> {
    const section = await this.createSection.execute(payload.sub, dto);
    return ApiResponseDto.ok(SectionResponseDto.fromDomain(section), 'Sección creada exitosamente');
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reordenar secciones',
    description:
      'Body: `{ orderedIds: [...] }`. Reasignamos `position` 1..N en orden. IDs no listados quedan donde están.',
  })
  @ApiResponse({ status: 204, description: 'Reordenamiento aplicado' })
  @ApiResponse({ status: 422, description: 'Algún ID no existe o no pertenece al usuario' })
  async reorder(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ReorderSectionsDto,
  ): Promise<void> {
    await this.reorderSections.execute(payload.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nombre / color de una sección' })
  @ApiParam({ name: 'id', description: 'UUID de la sección' })
  @ApiResponse({ status: 200, description: 'Sección actualizada', type: SectionResponseDto })
  @ApiResponse({ status: 404, description: 'Sección no encontrada' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
  ): Promise<ApiResponseDto<SectionResponseDto>> {
    const section = await this.updateSection.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      SectionResponseDto.fromDomain(section),
      'Sección actualizada exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar sección (cascade)',
    description:
      'CUIDADO: borra también todas las tasks dentro de la sección (FK ON DELETE CASCADE). El frontend muestra confirm con el conteo antes de invocar.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la sección' })
  @ApiResponse({ status: 204, description: 'Sección + sus tasks eliminadas' })
  @ApiResponse({ status: 404, description: 'Sección no encontrada' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteSection.execute(id, payload.sub);
  }
}
