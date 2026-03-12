import { type Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(isPublic: boolean) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    __isPublic: isPublic,
  } as never;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as never;
    guard = new JwtAuthGuard(reflector);
  });

  it('should return true immediately when the route is marked @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = buildContext(true);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });

  it('should delegate to super.canActivate() when the route is not public', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const context = buildContext(false);
    await guard.canActivate(context);

    expect(superCanActivate).toHaveBeenCalledWith(context);
    superCanActivate.mockRestore();
  });
});
