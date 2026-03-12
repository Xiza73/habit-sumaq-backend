import { buildUser } from '../../domain/__tests__/user.factory';

import { UserResponseDto } from './user-response.dto';

describe('UserResponseDto.fromDomain()', () => {
  it('should map all fields from a domain User', () => {
    const user = buildUser({
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      isActive: true,
    });

    const dto = UserResponseDto.fromDomain(user);

    expect(dto.id).toBe(user.id);
    expect(dto.email).toBe('test@example.com');
    expect(dto.name).toBe('Test User');
    expect(dto.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(dto.isActive).toBe(true);
    expect(dto.createdAt).toBe(user.createdAt);
    expect(dto.updatedAt).toBe(user.updatedAt);
  });

  it('should not expose the googleId field', () => {
    const user = buildUser();
    const dto = UserResponseDto.fromDomain(user);
    expect(dto).not.toHaveProperty('googleId');
  });

  it('should map avatarUrl as null when the user has no avatar', () => {
    const user = buildUser({ avatarUrl: null });
    const dto = UserResponseDto.fromDomain(user);
    expect(dto.avatarUrl).toBeNull();
  });
});
