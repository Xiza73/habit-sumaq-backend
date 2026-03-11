import { ERROR_CODES, type ErrorCodeKey } from '../errors/error-codes';

export class DomainException extends Error {
  public readonly code: ErrorCodeKey;
  public readonly hashedCode: string;

  constructor(code: ErrorCodeKey, message: string) {
    super(message);
    this.name = 'DomainException';
    this.code = code;
    this.hashedCode = ERROR_CODES[code];
  }
}
