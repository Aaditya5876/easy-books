import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PORTAL_ROLES_KEY } from '../decorators/portal-roles.decorator';

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

    const required = this.reflector.getAllAndOverride<string[]>(PORTAL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length && !required.includes(payload.portalType)) {
      throw new ForbiddenException(`Portal role '${payload.portalType}' cannot access this resource`);
    }

    return true;
  }
}
