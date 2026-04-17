import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateLedgerEntryDTO, UpdateLedgerEntryDTO } from '@easy-books/shared';

@Injectable()
export class LedgerEntryServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.ledgerEntry.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.ledgerEntry.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateLedgerEntryDTO) {
    return this.prisma.ledgerEntry.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateLedgerEntryDTO) {
    return this.prisma.ledgerEntry.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.ledgerEntry.delete({ where: { id } });
  }
}
