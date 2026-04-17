import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { AuthController } from '../adapter/input/api/v1/auth.controller';
import { AuthServiceImpl } from '../application/services/auth.service.impl';
import { UserPsqlRepository } from '../adapter/output/persistence/psql/user.psql.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AUTH_SERVICE } from '../domain/services/auth.service';
import { USER_REPOSITORY } from '../domain/repositories';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: AUTH_SERVICE, useClass: AuthServiceImpl },
    { provide: USER_REPOSITORY, useClass: UserPsqlRepository },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
