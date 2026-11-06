import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SKIP_PASSWORD_CHECK_KEY } from '../decorators/skip-password-check.decorator';
import { PrismaService } from '../../../core/db/psql/prisma.client';

export const PORTAL_COOKIE = 'portalToken';

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // The browser sends the HttpOnly cookie; a Bearer header is still accepted
    // for API clients.
    const auth = req.headers.authorization;
    const token = req.cookies?.[PORTAL_COOKIE] || (auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null);
    if (!token) throw new UnauthorizedException('Portal token required');
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.type !== 'portal') throw new UnauthorizedException('Invalid portal token');
    } catch {
      throw new UnauthorizedException('Invalid or expired portal token');
    }

    // Tokens are revoked by bumping tokenVersion (logout, password change,
    // admin reset); a disabled account loses access immediately.
    const account = await this.prisma.portalUser.findUnique({
      where: { studentId: payload.studentId },
      select: { isActive: true, tokenVersion: true },
    });
    if (!account?.isActive || account.tokenVersion !== (payload.tv ?? 0)) {
      throw new UnauthorizedException('Session has ended — please log in again');
    }
    req.portalUser = payload;

    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (payload.mustChangePassword && !skipCheck) {
      throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    }

    return true;
  }
}
