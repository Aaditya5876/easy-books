import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    const debit = Number((dto as any).debit ?? 0);
    const credit = Number((dto as any).credit ?? 0);

    if (debit < 0 || credit < 0) {
      throw new BadRequestException('Debit and credit amounts must be non-negative');
    }
    if (debit > 0 && credit > 0) {
      throw new BadRequestException('A ledger entry cannot have both debit and credit amounts — use one side only');
    }
    if (debit === 0 && credit === 0) {
      throw new BadRequestException('A ledger entry must have either a debit or a credit amount');
    }

    return this.prisma.ledgerEntry.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateLedgerEntryDTO) {
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    if (entry.isAutoPosted) {
      throw new BadRequestException('Auto-posted ledger entries cannot be edited manually');
    }

    const debit = Number((dto as any).debit ?? entry.debit);
    const credit = Number((dto as any).credit ?? entry.credit);

    if (debit > 0 && credit > 0) {
      throw new BadRequestException('A ledger entry cannot have both debit and credit amounts');
    }

    return this.prisma.ledgerEntry.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    if (entry.isAutoPosted) {
      throw new BadRequestException('Auto-posted ledger entries cannot be deleted manually');
    }
    return this.prisma.ledgerEntry.delete({ where: { id } });
  }
}
