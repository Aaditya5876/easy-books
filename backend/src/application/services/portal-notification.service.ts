import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

interface PortalNotifyPayload {
  title: string;
  message: string;
  link?: string;
  referenceType?: string;
  referenceId?: string;
}

// Parent/student-portal equivalent of NotificationServiceImpl — kept as its
// own service because PortalUser isn't a User, so it can't share the staff
// notification table/queries.
@Injectable()
export class PortalNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyStudent(companyId: string, studentId: string, payload: PortalNotifyPayload): Promise<void> {
    await this.prisma.portalNotification.create({
      data: {
        companyId,
        studentId,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
      },
    });
  }

  async listForStudent(studentId: string, companyId: string) {
    return this.prisma.portalNotification.findMany({
      where: { studentId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async getUnreadCount(studentId: string, companyId: string): Promise<number> {
    return this.prisma.portalNotification.count({ where: { studentId, companyId, isRead: false } });
  }

  async markRead(id: string, studentId: string) {
    const notif = await this.prisma.portalNotification.findFirst({ where: { id, studentId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.isRead) return notif;
    return this.prisma.portalNotification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(studentId: string, companyId: string): Promise<{ updated: number }> {
    const result = await this.prisma.portalNotification.updateMany({
      where: { studentId, companyId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}
