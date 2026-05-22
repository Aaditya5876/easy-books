import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = { companyId, deletedAt: { not: null, lte: cutoff } } as any;
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
}
