import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { uploadOwner } from '../../adapter/input/api/v1/upload.util';
import { PORTAL_COOKIE } from './portal.guard';

// Files are named <companyId>_<uuid>.<ext>: only that company's staff and its
// students' portal accounts may open them. A file without the prefix belongs
// to no school (core/maintenance/backfill-upload-owners.ts moved every linked
// one), so only the platform owner can open it.
@Injectable()
export class UploadAccessGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // Browsers send the staff or portal session cookie on plain <img>/<a> links.
    // A ?token= query param is still accepted for older links on this one
    // read-only route (the request logger masks it).
    const token = req.cookies?.accessToken || req.cookies?.[PORTAL_COOKIE] || this.extractBearer(req) || req.query?.token;
    if (!token) throw new UnauthorizedException('Authentication required to access this file');
    const owner = uploadOwner(String(req.params?.filename ?? ''));

    const staff = this.verify(token, process.env.JWT_ACCESS_SECRET);
    if (staff) {
      if (staff.role === 'SUPER_ADMIN') return true;
      if (!owner) throw new ForbiddenException('You do not have access to this file');
      const member = await this.prisma.userCompany.findFirst({ where: { userId: staff.sub, companyId: owner }, select: { id: true } });
      if (!member) throw new ForbiddenException('You do not have access to this file');
      return true;
    }

    const portal = this.verify(token, process.env.JWT_SECRET);
    if (portal?.type === 'portal') {
      // Same revocation rule as PortalGuard.
      const account = await this.prisma.portalUser.findUnique({
        where: { studentId: portal.studentId }, select: { isActive: true, tokenVersion: true },
      });
      if (!account?.isActive || account.tokenVersion !== (portal.tv ?? 0)) {
        throw new UnauthorizedException('Session has ended — please log in again');
      }
      if (owner !== portal.companyId) throw new ForbiddenException('You do not have access to this file');
      return true;
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  private verify(token: string, secret?: string): any {
    try {
      return this.jwtService.verify(token, { secret });
    } catch {
      return null;
    }
  }

  private extractBearer(req: any): string | null {
    const auth = req.headers?.authorization;
    if (!auth) return null;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
