/**
 * Shared PinoLogger mock for unit tests. Returned object matches the subset
 * of `PinoLogger` that our use-cases actually call — cast to the real type
 * at the call site via `as unknown as PinoLogger`.
 */
export function buildMockPinoLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
  };
}
