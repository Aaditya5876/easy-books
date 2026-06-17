import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDTO, RegisterDTO } from '@easy-books/shared';
import { IAuthService, AuthTokens } from '../../domain/services/auth.service';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { MailService } from './mail.service';

@Injectable()
export class AuthServiceImpl implements IAuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDTO): Promise<{ requiresVerification: true; email: string }> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      if (!existing.emailVerified) {
        // Resend OTP to unverified account
        const otp = this.generateOtp();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { verificationOtp: otp, otpExpiresAt },
        });
        await this.mailService.sendOtpVerification(existing.email, existing.name, otp);
        return { requiresVerification: true, email: existing.email };
      }
      throw new ConflictException('Email already registered');
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        businessType: dto.businessType,
        registrationNumber: dto.registrationNumber,
        defaultUnitType: dto.defaultUnitType,
      },
    });

    const hashed = await bcrypt.hash(dto.password, 10);
    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        name: dto.name,
        role: 'ADMIN',
        emailVerified: false,
        verificationOtp: otp,
        otpExpiresAt,
      },
    });

    await this.prisma.userCompany.create({
      data: { userId: user.id, companyId: company.id, isDefault: true },
    });

    await this.mailService.sendOtpVerification(user.email, user.name, otp);

    return { requiresVerification: true, email: user.email };
  }

  async verifyOtp(email: string, otp: string): Promise<AuthTokens> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email already verified');
    if (!user.verificationOtp) throw new UnauthorizedException('Invalid verification code');
    const otpMatch =
      user.verificationOtp.length === otp.length &&
      crypto.timingSafeEqual(Buffer.from(user.verificationOtp), Buffer.from(otp));
    if (!otpMatch) throw new UnauthorizedException('Invalid verification code');
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new UnauthorizedException('Verification code has expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationOtp: null, otpExpiresAt: null },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async resendOtp(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email already verified');

    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationOtp: otp, otpExpiresAt },
    });
    await this.mailService.sendOtpVerification(user.email, user.name, otp);
  }

  async login(dto: LoginDTO): Promise<AuthTokens & { mustChangePassword: boolean }> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { ...tokens, mustChangePassword: user.mustChangePassword };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false },
    });
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

    const defaultUC = await this.prisma.userCompany.findFirst({
      where: { userId, isDefault: true },
      include: { company: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      defaultCompanyId: defaultUC?.company.id || null,
      defaultCompany: defaultUC?.company || null,
    };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

    return { accessToken, refreshToken, userId };
  }
}
