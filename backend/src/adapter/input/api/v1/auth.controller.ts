import { Controller, Post, Get, Body, Req, Res, Inject, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Register new user and company' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password', 'name', 'companyName'], properties: { email: { type: 'string', example: 'user@example.com' }, password: { type: 'string', example: 'password123' }, name: { type: 'string', example: 'John Doe' }, companyName: { type: 'string', example: 'My Company' } } } })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    this.setTokenCookies(res, tokens);
    return { success: true, message: 'Registered successfully' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password (rate-limited: 5 per minute)' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'user@example.com' }, password: { type: 'string', example: 'password123' } } } })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    this.setTokenCookies(res, tokens);
    return { success: true, message: 'Login successful' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = req.cookies?.userId;
    const refreshToken = req.cookies?.refreshToken;
    if (!userId || !refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
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
