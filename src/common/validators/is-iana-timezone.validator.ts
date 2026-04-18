import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Validates that a string is a valid IANA timezone identifier
 * (e.g. `America/Lima`, `Europe/Madrid`, `UTC`).
 *
 * Uses `Intl.DateTimeFormat` — if instantiation throws `RangeError`,
 * the value is rejected.
 */
export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function register(object: object, propertyName: string): void {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || value.length === 0) return false;
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} debe ser una zona horaria IANA válida (ej: "America/Lima", "Europe/Madrid")`;
        },
      },
    });
  };
}
