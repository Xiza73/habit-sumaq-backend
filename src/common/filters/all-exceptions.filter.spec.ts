/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

import { DomainException } from '../exceptions/domain.exception';

import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost(responseMock: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => responseMock,
    }),
  } as never;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let responseMock: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    const json = jest.fn();
    responseMock = { status: jest.fn().mockReturnValue({ json }), json };
  });

  describe('DomainException', () => {
    it('should respond with the mapped HTTP status and error code', () => {
      const exception = new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
      filter.catch(exception, buildHost(responseMock));

      expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      const body = responseMock.status.mock.results[0].value.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(exception.errorCode);
    });

    it('should respond with 500 for an unmapped domain code', () => {
      const exception = new DomainException('VALIDATION_ERROR', 'Error');
      // Override the code to something that won't map to a known status
      Object.defineProperty(exception, 'code', { value: 'UNKNOWN_CODE' as never });
      filter.catch(exception, buildHost(responseMock));

      expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('HttpException', () => {
    it('should respond with the exception status and message', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      filter.catch(exception, buildHost(responseMock));

      expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      const body = responseMock.status.mock.results[0].value.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.message).toBe('Forbidden');
    });

    it('should include validation details for 400 with array messages', () => {
      const exception = new BadRequestException({ message: ['name must not be empty'] });
      filter.catch(exception, buildHost(responseMock));

      expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const body = responseMock.status.mock.results[0].value.json.mock.calls[0][0];
      expect(body.message).toBe('Los datos enviados son inválidos');
      expect(body.error.details).toEqual(['name must not be empty']);
    });
  });

  describe('unknown error', () => {
    it('should respond with 500 for an unhandled error', () => {
      filter.catch(new Error('Unexpected'), buildHost(responseMock));

      expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = responseMock.status.mock.results[0].value.json.mock.calls[0][0];
      expect(body.message).toBe('Error interno del servidor');
    });
  });
});
