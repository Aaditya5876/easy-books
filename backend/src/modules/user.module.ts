import { Module } from '@nestjs/common';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { UserController } from '../adapter/input/api/v1/user.controller';
import { UserServiceImpl } from '../application/services/user.service.impl';

@Module({
  controllers: [UserController],
  providers: [PrismaService, UserServiceImpl],
  exports: [UserServiceImpl],
})
export class UserModule {}
