import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../../../domain/repositories';
import { UserEntity } from '../../../../domain/entities/user.entity';
import { PrismaService } from '../../../../../core/db/psql/prisma.client';

@Injectable()
export class UserPsqlRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: Partial<UserEntity>): Promise<UserEntity> {
    return this.prisma.user.create({ data: data as any });
  }

  async updateRefreshToken(id: string, token: string | null): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { refreshToken: token } });
  }
}
