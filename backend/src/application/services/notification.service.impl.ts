import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { NotificationType } from '@prisma/client';

interface NotificationStreamEvent {
  type: 'notification' | 'count';
  payload?: {
    id?: string;
    title?: string;
    message?: string;
    link?: string;
    referenceType?: string;
    referenceId?: string;
    type?: NotificationType;
    createdAt?: string;
    isRead?: boolean;
  };
  unreadCount?: number;
}

interface NotifyPayload {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  referenceType?: string;
  referenceId?: string;
  details?: unknown;
}

type PreferenceCategory = 'transactions' | 'reminders' | 'system';

// Which Settings → Notification Preferences toggle gates each event type.
// Anything not listed always sends (nothing to opt out of).
const CATEGORY_BY_TYPE: Partial<Record<NotificationType, PreferenceCategory>> = {
  LOW_STOCK: 'transactions',
  FEE_PAYMENT: 'transactions',
  LEAVE_REQUEST: 'reminders',
  PAYROLL_PAID: 'reminders',
  SYSTEM_AUTOMATION: 'system',
};

@Injectable()
export class NotificationServiceImpl {
  private readonly subscribers = new Map<string, Set<(event: NotificationStreamEvent) => void>>();

  constructor(private readonly prisma: PrismaService) {}

  addSubscriber(userId: string, handler: (event: NotificationStreamEvent) => void): void {
    const set = this.subscribers.get(userId) ?? new Set();
    set.add(handler);
    this.subscribers.set(userId, set);
  }

  removeSubscriber(userId: string, handler: (event: NotificationStreamEvent) => void): void {
    const set = this.subscribers.get(userId);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.subscribers.delete(userId);
  }

  private emitToUser(userId: string, event: NotificationStreamEvent): void {
    const handlers = this.subscribers.get(userId);
    if (!handlers) return;
    handlers.forEach((handler) => handler(event));
  }

  async notifyRole(companyId: string, roles: string[], payload: NotifyPayload): Promise<void> {
    const links = await this.prisma.userCompany.findMany({
      where: { companyId, user: { role: { in: roles as any } } },
      select: { userId: true },
    });
    if (links.length === 0) return;

    const category = CATEGORY_BY_TYPE[payload.type];
    let recipientIds = links.map((l) => l.userId);
    if (category) {
      const prefs = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: recipientIds } },
      });
      const optedOut = new Set(prefs.filter((p) => (p as any)[category] === false).map((p) => p.userId));
      recipientIds = recipientIds.filter((id) => !optedOut.has(id));
    }
    if (recipientIds.length === 0) return;

    const rows = recipientIds.map((userId) => ({
      companyId,
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link,
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
      details: payload.details as any,
    }));

    await this.prisma.notification.createMany({ data: rows });

    const unreadCount = await this.prisma.notification.count({ where: { userId: { in: recipientIds }, isRead: false } });
    const createdAt = new Date().toISOString();
    recipientIds.forEach((userId) => {
      this.emitToUser(userId, {
        type: 'notification',
        payload: {
          title: payload.title,
          message: payload.message,
          link: payload.link,
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          type: payload.type,
          createdAt,
          isRead: false,
        },
      });
      this.emitToUser(userId, {
        type: 'count',
        unreadCount,
      });
    });
  }

  // Platform-level notifications (subscription lapsed/renewal requested) have
  // no natural companyId to scope UserCompany lookups by on the recipient
  // side — SUPER_ADMIN isn't necessarily a member of the client company this
  // is about. Goes straight to User instead of notifyRole's UserCompany join.
  // The client's companyId is still stored on the row (Notification.companyId
  // is mandatory) purely for context — cascade-deletes with that company,
  // which is correct: no point keeping a notification about a company that
  // no longer exists.
  async notifySuperAdmins(companyId: string, payload: NotifyPayload): Promise<void> {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    if (superAdmins.length === 0) return;

    const rows = superAdmins.map((u) => ({
      companyId,
      userId: u.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link,
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
      details: payload.details as any,
    }));

    await this.prisma.notification.createMany({ data: rows });

    const unreadCounts = await Promise.all(
      superAdmins.map(({ id }) => this.prisma.notification.count({ where: { userId: id, isRead: false } })),
    );

    const createdAt = new Date().toISOString();
    superAdmins.forEach(({ id }, index) => {
      this.emitToUser(id, {
        type: 'notification',
        payload: {
          title: payload.title,
          message: payload.message,
          link: payload.link,
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          type: payload.type,
          createdAt,
          isRead: false,
        },
      });
      this.emitToUser(id, {
        type: 'count',
        unreadCount: unreadCounts[index],
      });
    });
  }

  async getPreference(userId: string) {
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return pref ?? { transactions: true, reminders: true, system: true };
  }

  async updatePreference(userId: string, data: { transactions?: boolean; reminders?: boolean; system?: boolean }) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async listForUser(userId: string, opts: { page?: number; pageSize?: number; unreadOnly?: boolean; type?: NotificationType }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where = { userId, ...(opts.unreadOnly ? { isRead: false } : {}), ...(opts.type ? { type: opts.type } : {}) };

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
