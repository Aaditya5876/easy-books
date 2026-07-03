import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Portal token required');
    const token = auth.split(' ')[1];
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'easybooks-secret',
      });
      if (payload.type !== 'portal') throw new UnauthorizedException('Invalid portal token');
      req.portalUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired portal token');
    }
  }
}
