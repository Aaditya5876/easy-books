import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SKIP_PASSWORD_CHECK_KEY } from '../decorators/skip-password-check.decorator';

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Portal token required');
    const token = auth.split(' ')[1];
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.type !== 'portal') throw new UnauthorizedException('Invalid portal token');
    } catch {
      throw new UnauthorizedException('Invalid or expired portal token');
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
