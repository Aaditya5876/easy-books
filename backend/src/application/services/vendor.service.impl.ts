import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateVendorDTO, UpdateVendorDTO } from '@easy-books/shared';

@Injectable()
export class VendorServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.vendor.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(dto: CreateVendorDTO) {
    return this.prisma.vendor.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateVendorDTO) {
    return this.prisma.vendor.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const hasOrders = await this.prisma.purchaseOrder.findFirst({ where: { vendorId: id } });
    if (hasOrders) {
      throw new BadRequestException('Cannot delete vendor with existing purchase orders');
    }

    return this.prisma.vendor.delete({ where: { id } });
  }
}
