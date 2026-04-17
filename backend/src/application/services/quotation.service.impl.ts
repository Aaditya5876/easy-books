import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateQuotationDTO, UpdateQuotationDTO } from '@easy-books/shared';

@Injectable()
export class QuotationServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.quotation.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.quotation.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateQuotationDTO) {
    return this.prisma.quotation.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateQuotationDTO) {
    return this.prisma.quotation.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.quotation.delete({ where: { id } });
  }
}
