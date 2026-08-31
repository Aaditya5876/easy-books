import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

export interface AuditLogEntry {
  companyId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  module: string;
  entityId?: string | null;
  method: string;
  path: string;
  changes?: unknown;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Audit logging must never break the request it's recording — any failure
  // here is swallowed (and just logged) rather than propagated.
  async record(entry: AuditLogEntry) {
    try {
      await this.prisma.auditLog.create({ data: entry as any });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async list(params: {
    companyId: string;
    userId?: string;
    module?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
    const { companyId, userId, module, action, dateFrom, dateTo, limit } = params;
    if (!companyId) throw new BadRequestException('companyId is required');
    return this.prisma.auditLog.findMany({
      where: {
        companyId,
        ...(userId ? { userId } : {}),
        ...(module ? { module } : {}),
        ...(action ? { action } : {}),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 100,
    });
  }
}
