import { ApiResponse } from './api-response.dto';

describe('ApiResponse', () => {
  describe('ok()', () => {
    it('should return a successful response with data and message', () => {
      const result = ApiResponse.ok({ id: '1' }, 'Operación exitosa');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1' });
      expect(result.message).toBe('Operación exitosa');
      expect(result.error).toBeUndefined();
    });

    it('should include pagination meta when provided', () => {
      const meta = { page: 1, limit: 20, total: 45, totalPages: 3 };
      const result = ApiResponse.ok([], 'Lista', meta);

      expect(result.meta).toEqual(meta);
    });

    it('should accept null as valid data', () => {
      const result = ApiResponse.ok(null, 'Sin datos');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('fail()', () => {
    it('should return a failure response with code and message', () => {
      const result = ApiResponse.fail('Recurso no encontrado', 'a3f1c209');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.message).toBe('Recurso no encontrado');
      expect(result.error?.code).toBe('a3f1c209');
    });

    it('should include details when provided', () => {
      const details = [{ field: 'name', message: 'required' }];
      const result = ApiResponse.fail('Validación fallida', 'abc123', details);

      expect(result.error?.details).toEqual(details);
    });

    it('should not include details key when not provided', () => {
      const result = ApiResponse.fail('Error', 'abc123');

      expect(result.error).not.toHaveProperty('details');
    });
  });
});
