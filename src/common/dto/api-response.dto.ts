import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class ErrorDetail {
  @ApiProperty({ example: 'a3f1c209' })
  code: string;

  @ApiPropertyOptional({
    example: [{ field: 'name', message: 'name should not be empty' }],
  })
  details?: unknown;
}

export class ApiResponse<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ nullable: true })
  data: T | null;

  @ApiProperty({ example: 'Operación exitosa' })
  message: string;

  @ApiPropertyOptional({ type: ErrorDetail })
  error?: ErrorDetail;

  @ApiPropertyOptional({ type: PaginationMeta })
  meta?: PaginationMeta;

  static ok<T>(data: T, message: string, meta?: PaginationMeta): ApiResponse<T> {
    return { success: true, data, message, meta };
  }

  static fail(message: string, code: string, details?: unknown): ApiResponse<null> {
    return {
      success: false,
      data: null,
      message,
      error: { code, ...(details !== undefined && { details }) },
    };
  }
}
