import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Inject,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { LoginSchema, RegisterSchema, LoginDTO, RegisterDTO } from '@easy-books/shared';
import { IAuthService, AUTH_SERVICE } from '../../../../domain/services/auth.service';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { Public } from '../../../../modules/decorators/public.decorator';

@ApiTags('Auth')
@SkipThrottle()
@Controller('api/v1/auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: IAuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user and company — sends OTP for email verification' })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDTO) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and complete registration — issues auth tokens' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'otp'], properties: { email: { type: 'string' }, otp: { type: 'string' } } } })
  async verifyOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyOtp(email, otp);
    this.setTokenCookies(res, tokens);
    return { success: true, message: 'Email verified successfully' };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend OTP verification email (rate-limited: 3 per minute)' })
  @ApiBody({ schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } })
  async resendOtp(@Body('email') email: string) {
    await this.authService.resendOtp(email);
    return { success: true, message: 'Verification code resent' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password (rate-limited: 5 per minute)' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setTokenCookies(res, result);
    return { success: true, message: 'Login successful', mustChangePassword: result.mustChangePassword };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (required on first login for invited users)' })
  @ApiBody({ schema: { type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } } })
  async changePassword(
    @Req() req: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.changePassword(req.user.sub, currentPassword, newPassword);
    return { success: true, message: 'Password changed successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = req.cookies?.userId;
    const refreshToken = req.cookies?.refreshToken;
    if (!userId || !refreshToken) throw new UnauthorizedException('No refresh token');
    const tokens = await this.authService.refresh(userId, refreshToken);
    this.setTokenCookies(res, tokens);
    return { success: true, message: 'Token refreshed' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and clear cookies' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.sub);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('userId');
    return { success: true, message: 'Logged out' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }

  private setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken: string; userId: string }) {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true, secure, sameSite: 'strict', maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie('userId', tokens.userId, {
      httpOnly: true, secure, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
