import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { NotificationType } from '@prisma/client';

interface NotifyPayload {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  referenceType?: string;
  referenceId?: string;
  details?: unknown;
}

@Injectable()
export class NotificationServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async notifyRole(companyId: string, roles: string[], payload: NotifyPayload): Promise<void> {
    const links = await this.prisma.userCompany.findMany({
      where: { companyId, user: { role: { in: roles as any } } },
      select: { userId: true },
    });
    if (links.length === 0) return;

    await this.prisma.notification.createMany({
      data: links.map((l) => ({
        companyId,
        userId: l.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        details: payload.details as any,
      })),
    });
  }

  async listForUser(userId: string, opts: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where = { userId, ...(opts.unreadOnly ? { isRead: false } : {}) };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' as const },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.isRead) return notif;
    return this.prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
