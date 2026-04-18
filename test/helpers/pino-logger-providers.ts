import { getLoggerToken } from 'nestjs-pino';

import { buildMockPinoLogger } from '../../src/common/__tests__/pino-logger.mock';

/**
 * Returns Nest providers for PinoLogger tokens scoped to the given class names.
 * Use this in e2e `Test.createTestingModule` to satisfy `@InjectPinoLogger()`
 * dependencies without importing the real `LoggerModule`.
 *
 * Example:
 *   providers: [
 *     ...buildPinoLoggerProviders([
 *       AllExceptionsFilter.name,
 *       CreateTransactionUseCase.name,
 *     ]),
 *   ]
 */
export function buildPinoLoggerProviders(classNames: string[]) {
  return classNames.map((name) => ({
    provide: getLoggerToken(name),
    useValue: buildMockPinoLogger(),
  }));
}
