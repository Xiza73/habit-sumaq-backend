import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';

import { map } from 'rxjs/operators';

import { ApiResponse } from '../dto/api-response.dto';

import type { Observable } from 'rxjs';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Si el handler ya devuelve un ApiResponse, no envolver de nuevo
        if (data instanceof Object && 'success' in data && 'data' in data) {
          return data as unknown as ApiResponse<T>;
        }
        return ApiResponse.ok(data, 'Operación exitosa');
      }),
    );
  }
}
