import { of } from 'rxjs';

import { ApiResponse } from '../dto/api-response.dto';

import { ResponseTransformInterceptor } from './response-transform.interceptor';

const mockCallHandler = (returnValue: unknown) => ({
  handle: () => of(returnValue),
});

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
  });

  it('should wrap a plain object in ApiResponse', (done) => {
    const handler = mockCallHandler({ id: '1', name: 'Test' });

    interceptor.intercept(null as never, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
      done();
    });
  });

  it('should not double-wrap a response that is already an ApiResponse', (done) => {
    const already = ApiResponse.ok({ id: '1' }, 'Ya envuelto');
    const handler = mockCallHandler(already);

    interceptor.intercept(null as never, handler).subscribe((result) => {
      expect(result).toBe(already);
      expect(result.message).toBe('Ya envuelto');
      done();
    });
  });

  it('should wrap null as data', (done) => {
    const handler = mockCallHandler(null);

    interceptor.intercept(null as never, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      done();
    });
  });
});
