import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

@Injectable()
export class PettyCashServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.pettyCashVoucher.findMany({
      where: { companyId },
      orderBy: { dateAd: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    const v = await this.prisma.pettyCashVoucher.findFirst({ where: { id, companyId } });
    if (!v) throw new NotFoundException('Petty cash voucher not found');
    return v;
  }

  async create(companyId: string, data: {
    voucherNo: string;
    dateAd: string;
    amount: number;
    description: string;
    category?: string;
    paidTo?: string;
    approvedBy?: string;
  }) {
    const dateAd = new Date(data.dateAd);
    return this.prisma.pettyCashVoucher.create({
      data: {
        companyId,
        voucherNo: data.voucherNo,
        dateAd,
        dateBs: adToBs(dateAd),
        amount: data.amount,
        description: data.description,
        category: data.category,
        paidTo: data.paidTo,
        approvedBy: data.approvedBy,
      },
    });
  }

  async remove(id: string, companyId: string) {
    const v = await this.prisma.pettyCashVoucher.findFirst({ where: { id, companyId } });
    if (!v) throw new NotFoundException('Petty cash voucher not found');
    return this.prisma.pettyCashVoucher.delete({ where: { id } });
  }

  async getSummary(companyId: string, fromDate: string, toDate: string) {
    const vouchers = await this.prisma.pettyCashVoucher.findMany({
      where: {
        companyId,
        dateAd: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      orderBy: { dateAd: 'asc' },
    });

    const totalSpent = vouchers.reduce((sum, v) => sum + Number(v.amount), 0);
    const byCategory = vouchers.reduce<Record<string, number>>((acc, v) => {
      const cat = v.category ?? 'Uncategorized';
      acc[cat] = (acc[cat] ?? 0) + Number(v.amount);
      return acc;
    }, {});

    return { vouchers, totalSpent, byCategory };
  }
}
