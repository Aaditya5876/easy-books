import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Uploaded files (payment-proof screenshots, bank QR codes, logos, employee
// documents...) used to be served fully unauthenticated via static hosting —
// anyone with a URL, logged in or not, could fetch them. This requires SOME
// valid session — either a staff access token or a portal (parent/student)
// token — before a file is returned. It intentionally does not check that the
// token's company matches the file: filenames are random UUIDs (see
// upload.util.ts) and a URL is only ever handed out through an
// already-company-scoped API response, so the residual risk is guessing a
// UUIDv4, not browsing/enumerating other tenants' files.
@Injectable()
export class UploadAccessGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Portal sessions are Bearer-only (localStorage token, no cookie), and a
    // plain <img src>/<a href> can't attach an Authorization header — so a
    // ?token= query param is accepted too, scoped to this one read-only route.
    const token = req.cookies?.accessToken || this.extractBearer(req) || req.query?.token;
    if (!token) throw new UnauthorizedException('Authentication required to access this file');

    try {
      this.jwtService.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
      return true;
    } catch {
      // not a staff token — fall through and try the portal token secret
    }

    try {
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      if (payload?.type === 'portal') return true;
    } catch {
      // not a valid portal token either
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  private extractBearer(req: any): string | null {
    const auth = req.headers?.authorization;
    if (!auth) return null;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
