import type { User } from './user.entity';

export interface CreateUserData {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export abstract class UserRepository {
  abstract findByGoogleId(googleId: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract create(data: CreateUserData): Promise<User>;
  abstract save(user: User): Promise<User>;
}
