import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DOMAIN_HTTP_MAP } from '../errors/domain-error.map';
import { ERROR_CODES } from '../errors/error-codes';
import { DomainException } from '../exceptions/domain.exception';

import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof DomainException) {
      const status = DOMAIN_HTTP_MAP[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.warn(
        { event: 'exception.domain', errorCode: exception.code, message: exception.message },
        'exception.domain',
      );
      response.status(status).json({
        success: false,
        data: null,
        message: exception.message,
        error: { code: exception.errorCode },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && 'message' in body
          ? Array.isArray((body as Record<string, unknown>).message)
            ? 'Los datos enviados son inválidos'
            : String((body as Record<string, unknown>).message)
          : exception.message;

      const isValidation = status === (HttpStatus.BAD_REQUEST as number);
      const details =
        isValidation &&
        typeof body === 'object' &&
        Array.isArray((body as Record<string, unknown>).message)
          ? (body as Record<string, string[]>).message
          : undefined;

      response.status(status).json({
        success: false,
        data: null,
        message,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          ...(details !== undefined && { details }),
        },
      });
      return;
    }

    this.logger.error({ event: 'exception.unhandled', err: exception }, 'exception.unhandled');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      data: null,
      message: 'Error interno del servidor',
    });
  }
}
