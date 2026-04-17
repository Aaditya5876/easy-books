import { UserEntity } from './entities/user.entity';

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  create(data: Partial<UserEntity>): Promise<UserEntity>;
  updateRefreshToken(id: string, token: string | null): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
