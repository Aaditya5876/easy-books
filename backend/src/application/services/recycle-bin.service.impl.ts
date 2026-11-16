import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../core/db/psql/prisma.client';

export type RecycleBinItemType =
  | 'client' | 'vendor' | 'employee' | 'inventory'
  | 'sales' | 'purchase' | 'task' | 'memo';

@Injectable()
export class RecycleBinServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async list(companyId: string) {
    const where = { companyId, deletedAt: { not: null } };

    const [clients, vendors, employees, inventory, sales, purchases, tasks, memos] = await Promise.all([
      this.prisma.client.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, name: true, email: true, phone: true, deletedAt: true } }),
      this.prisma.vendor.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, name: true, email: true, phone: true, deletedAt: true } }),
      this.prisma.employee.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, name: true, designation: true, department: true, deletedAt: true } }),
      this.prisma.inventoryItem.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, itemName: true, modelNo: true, brand: true, quantity: true, deletedAt: true } }),
      this.prisma.salesOrder.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, invoiceNumber: true, clientName: true, totalAmount: true, dateAd: true, deletedAt: true } }),
      this.prisma.purchaseOrder.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, orderNumber: true, vendorName: true, totalAmount: true, dateAd: true, deletedAt: true } }),
      this.prisma.task.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, title: true, assignedTo: true, status: true, dueDate: true, deletedAt: true } }),
      this.prisma.memoDocument.findMany({ where, orderBy: { deletedAt: 'desc' }, select: { id: true, title: true, documentType: true, dateAd: true, deletedAt: true } }),
    ]);

    return { clients, vendors, employees, inventory, sales, purchases, tasks, memos };
  }

  async restore(id: string, type: RecycleBinItemType, companyId: string) {
    await this.verifyDeletedOwnership(id, type, companyId);
    const data = { deletedAt: null };
    switch (type) {
      case 'client':    return this.prisma.client.update({ where: { id }, data });
      case 'vendor':    return this.prisma.vendor.update({ where: { id }, data });
      case 'employee':  return this.prisma.employee.update({ where: { id }, data });
      case 'inventory': return this.prisma.inventoryItem.update({ where: { id }, data });
      case 'sales':     return this.prisma.salesOrder.update({ where: { id }, data });
      case 'purchase':  return this.prisma.purchaseOrder.update({ where: { id }, data });
      case 'task':      return this.prisma.task.update({ where: { id }, data });
      case 'memo':      return this.prisma.memoDocument.update({ where: { id }, data });
      default: throw new BadRequestException('Unknown item type');
    }
  }

  async permanentDelete(id: string, type: RecycleBinItemType, companyId: string) {
    await this.verifyDeletedOwnership(id, type, companyId);
    switch (type) {
      case 'client':    return this.prisma.client.delete({ where: { id } });
      case 'vendor':    return this.prisma.vendor.delete({ where: { id } });
      case 'employee':  return this.prisma.employee.delete({ where: { id } });
      case 'inventory': return this.prisma.inventoryItem.delete({ where: { id } });
      case 'task':      return this.prisma.task.delete({ where: { id } });
      case 'memo':      return this.prisma.memoDocument.delete({ where: { id } });
      case 'sales': {
        const order = await this.prisma.salesOrder.findUnique({ where: { id }, include: { items: true } });
        if (!order) throw new NotFoundException('Sales order not found');
        await this.prisma.salesOrder.delete({ where: { id } });
        return order;
      }
      case 'purchase': {
        const order = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
        if (!order) throw new NotFoundException('Purchase order not found');
        await this.prisma.purchaseOrder.delete({ where: { id } });
        return order;
      }
      default: throw new BadRequestException('Unknown item type');
    }
  }

  private async verifyDeletedOwnership(id: string, type: RecycleBinItemType, companyId: string) {
    const where = { id, companyId, deletedAt: { not: null } } as any;
    let found: any = null;
    switch (type) {
      case 'client':    found = await this.prisma.client.findFirst({ where }); break;
      case 'vendor':    found = await this.prisma.vendor.findFirst({ where }); break;
      case 'employee':  found = await this.prisma.employee.findFirst({ where }); break;
      case 'inventory': found = await this.prisma.inventoryItem.findFirst({ where }); break;
      case 'sales':     found = await this.prisma.salesOrder.findFirst({ where }); break;
      case 'purchase':  found = await this.prisma.purchaseOrder.findFirst({ where }); break;
      case 'task':      found = await this.prisma.task.findFirst({ where }); break;
      case 'memo':      found = await this.prisma.memoDocument.findFirst({ where }); break;
    }
    if (!found) throw new NotFoundException('Item not found in recycle bin');
  }

  async emptyBin(companyId: string) {
    const where = { companyId, deletedAt: { not: null } } as any;
    await Promise.all([
      this.prisma.client.deleteMany({ where }),
      this.prisma.vendor.deleteMany({ where }),
      this.prisma.employee.deleteMany({ where }),
      this.prisma.inventoryItem.deleteMany({ where }),
      this.prisma.salesOrder.deleteMany({ where }),
      this.prisma.purchaseOrder.deleteMany({ where }),
      this.prisma.task.deleteMany({ where }),
      this.prisma.memoDocument.deleteMany({ where }),
    ]);
    return { success: true };
  }

  async cleanupOlderThan(companyId: string, days: number) {
    await purgeRecycleBin(this.prisma, companyId, days);
    return { success: true };
  }

  async restoreMany(companyId: string, items: RecycleBinRef[]) {
    for (const { id, type } of items) await this.restore(id, type, companyId);
    return { count: items.length };
  }

  async deleteMany(companyId: string, items: RecycleBinRef[]) {
    for (const { id, type } of items) await this.permanentDelete(id, type, companyId);
    return { count: items.length };
  }

  async restoreAll(companyId: string) {
    const where = { companyId, deletedAt: { not: null } } as any;
    const data = { deletedAt: null };
    const counts = await this.prisma.$transaction([
      this.prisma.client.updateMany({ where, data }),
      this.prisma.vendor.updateMany({ where, data }),
      this.prisma.employee.updateMany({ where, data }),
      this.prisma.inventoryItem.updateMany({ where, data }),
      this.prisma.salesOrder.updateMany({ where, data }),
      this.prisma.purchaseOrder.updateMany({ where, data }),
      this.prisma.task.updateMany({ where, data }),
      this.prisma.memoDocument.updateMany({ where, data }),
    ]);
    return { count: counts.reduce((s, c) => s + c.count, 0) };
  }

  async getSettings(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { recycleBinRetentionDays: true } });
    return { retentionDays: company?.recycleBinRetentionDays ?? 0 };
  }

  async updateSettings(companyId: string, retentionDays: number) {
    if (!RETENTION_CHOICES.includes(retentionDays)) {
      throw new BadRequestException(`retentionDays must be one of ${RETENTION_CHOICES.join(', ')} (0 = never)`);
    }
    await this.prisma.company.update({ where: { id: companyId }, data: { recycleBinRetentionDays: retentionDays || null } });
    return { retentionDays };
  }
}

export type RecycleBinRef = { id: string; type: RecycleBinItemType };

export const RETENTION_CHOICES = [0, 7, 15, 30, 60, 90, 180, 365];

// Permanently removes bin items deleted more than `days` ago. Shared by the
// manual cleanup endpoint and the nightly job (ScheduledTasksService).
export async function purgeRecycleBin(prisma: PrismaService, companyId: string, days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { companyId, deletedAt: { not: null, lte: cutoff } } as any;
  const counts = await Promise.all([
    prisma.client.deleteMany({ where }),
    prisma.vendor.deleteMany({ where }),
    prisma.employee.deleteMany({ where }),
    prisma.inventoryItem.deleteMany({ where }),
    prisma.salesOrder.deleteMany({ where }),
    prisma.purchaseOrder.deleteMany({ where }),
    prisma.task.deleteMany({ where }),
    prisma.memoDocument.deleteMany({ where }),
  ]);
  return counts.reduce((s, c) => s + c.count, 0);
}
