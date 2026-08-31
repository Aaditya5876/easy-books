import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../application/services/audit-log.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEY_PATTERN = /password|token|secret|otp|pin|api[-_]?key|signature|credential|account[-_]?number|date[-_]?of[-_]?birth|guardian[-_]?phone|pan[-_]?number|salary|ssf/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Whole-body routes where even key-level redaction isn't enough — the entire
// payload is either credentials/PII-dense (auth, bank accounts) or an entire
// spreadsheet of student/employee records (bulk import), or a signed
// third-party payment payload (eSewa/Khalti verify callbacks).
const WHOLE_BODY_REDACT_MODULES = [/^auth\//, /^bank-accounts/, /^bulk\//, /^portal\/pay\//];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY_PATTERN.test(k) ? '[REDACTED]' : redact(v),
      ]),
    );
  }
  return value;
}

// Records every non-GET API call — who (from the JWT the guards already
// validated), what action, on which module, and with what (redacted) payload.
// This is a global interceptor (see app.module.ts), so it applies uniformly
// across every controller without each one needing to call it explicitly.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl, params, query, body, user } = req;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const action = method === 'DELETE' ? 'DELETE' : method === 'POST' ? 'CREATE' : 'UPDATE';
    const pathSegments = (originalUrl.split('?')[0] as string).split('/').filter(Boolean);
    // Drop the "api"/"v1" prefix, then drop any trailing uuid-looking segments
    // (e.g. /api/v1/ledger/accounts/:id -> module "ledger/accounts").
    const moduleSegments = pathSegments.slice(2).filter((seg: string) => !UUID_PATTERN.test(seg));
    const module = moduleSegments.join('/') || 'unknown';
    const companyId = query?.companyId || body?.companyId || params?.companyId || null;
    const redactWholeBody = WHOLE_BODY_REDACT_MODULES.some((pattern) => pattern.test(module));

    return next.handle().pipe(
      tap((response) => {
        const entityId = params?.id || response?.id || null;
        this.auditLog
          .record({
            companyId,
            userId: user?.sub ?? null,
            userEmail: user?.email ?? null,
            userRole: user?.role ?? null,
            action,
            module,
            entityId,
            method,
            path: pathSegments.join('/'),
            changes: redactWholeBody ? '[REDACTED]' : redact(body),
          })
          .catch(() => {
            // AuditLogService.record already swallows/logs its own errors —
            // this catch just guards against a synchronous throw from .catch itself.
          });
      }),
    );
  }
}
