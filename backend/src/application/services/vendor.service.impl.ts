import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateVendorDTO, UpdateVendorDTO } from '@easy-books/shared';

@Injectable()
export class VendorServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.vendor.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(dto: CreateVendorDTO) {
    return this.prisma.vendor.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateVendorDTO) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.prisma.vendor.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.prisma.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
