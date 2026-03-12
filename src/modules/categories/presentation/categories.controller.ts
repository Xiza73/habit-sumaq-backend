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

import { CategoryResponseDto } from '../application/dto/category-response.dto';
import { CreateCategoryDto } from '../application/dto/create-category.dto';
import { GetCategoriesQueryDto } from '../application/dto/get-categories-query.dto';
import { UpdateCategoryDto } from '../application/dto/update-category.dto';
import { CreateCategoryUseCase } from '../application/use-cases/create-category.use-case';
import { DeleteCategoryUseCase } from '../application/use-cases/delete-category.use-case';
import { GetCategoriesUseCase } from '../application/use-cases/get-categories.use-case';
import { GetCategoryByIdUseCase } from '../application/use-cases/get-category-by-id.use-case';
import { UpdateCategoryUseCase } from '../application/use-cases/update-category.use-case';

import type { JwtPayload } from '../../auth/application/dto/jwt-payload.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly createCategory: CreateCategoryUseCase,
    private readonly getCategories: GetCategoriesUseCase,
    private readonly getCategoryById: GetCategoryByIdUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
    private readonly deleteCategory: DeleteCategoryUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva categoría' })
  @ApiResponse({ status: 201, description: 'Categoría creada', type: CategoryResponseDto })
  @ApiResponse({ status: 409, description: 'Ya existe una categoría con ese nombre' })
  async create(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: CreateCategoryDto,
  ): Promise<ApiResponseDto<CategoryResponseDto>> {
    const category = await this.createCategory.execute(payload.sub, dto);
    return ApiResponseDto.ok(
      CategoryResponseDto.fromDomain(category),
      'Categoría creada exitosamente',
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de categorías', type: [CategoryResponseDto] })
  async findAll(
    @CurrentUser() payload: JwtPayload,
    @Query() query: GetCategoriesQueryDto,
  ): Promise<ApiResponseDto<CategoryResponseDto[]>> {
    const categories = await this.getCategories.execute(payload.sub, query);
    return ApiResponseDto.ok(
      categories.map(CategoryResponseDto.fromDomain.bind(CategoryResponseDto)),
      'Categorías obtenidas exitosamente',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría por ID' })
  @ApiResponse({ status: 200, description: 'Categoría encontrada', type: CategoryResponseDto })
  @ApiResponse({ status: 403, description: 'La categoría pertenece a otro usuario' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  async findOne(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<CategoryResponseDto>> {
    const category = await this.getCategoryById.execute(id, payload.sub);
    return ApiResponseDto.ok(
      CategoryResponseDto.fromDomain(category),
      'Categoría obtenida exitosamente',
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nombre, color e ícono de una categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada', type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 409, description: 'El nuevo nombre ya está en uso' })
  async update(
    @CurrentUser() payload: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<ApiResponseDto<CategoryResponseDto>> {
    const category = await this.updateCategory.execute(id, payload.sub, dto);
    return ApiResponseDto.ok(
      CategoryResponseDto.fromDomain(category),
      'Categoría actualizada exitosamente',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una categoría (soft delete)' })
  @ApiResponse({ status: 204, description: 'Categoría eliminada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 409, description: 'No se pueden eliminar categorías por defecto' })
  async remove(@CurrentUser() payload: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.deleteCategory.execute(id, payload.sub);
  }
}
