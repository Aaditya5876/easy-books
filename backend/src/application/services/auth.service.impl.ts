import { Injectable, Inject, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDTO, RegisterDTO } from '@easy-books/shared';
import { IAuthService, AuthTokens } from '../../domain/services/auth.service';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories';
import { PrismaService } from '../../../core/db/psql/prisma.client';

@Injectable()
export class AuthServiceImpl implements IAuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDTO): Promise<AuthTokens> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const company = await this.prisma.company.create({
      data: { name: dto.companyName },
    });

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.create({
      email: dto.email,
      password: hashed,
      name: dto.name,
      role: 'ADMIN',
      companyId: company.id,
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDTO): Promise<AuthTokens> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.refreshToken) throw new UnauthorizedException('Access denied');

    const match = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!match) throw new UnauthorizedException('Access denied');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(userId: string): Promise<void> {
    await this.userRepo.updateRefreshToken(userId, null);
  }

  async me(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.companyId };
  }

  private async issueTokens(userId: string, email: string, role: string): Promise<AuthTokens> {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.updateRefreshToken(userId, hashedRefresh);

    return { accessToken, refreshToken };
  }
}
