import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateLedgerAccountDTO, UpdateLedgerAccountDTO } from '@easy-books/shared';

@Injectable()
export class LedgerAccountServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.ledgerAccount.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateLedgerAccountDTO) {
    return this.prisma.ledgerAccount.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateLedgerAccountDTO) {
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');
    if (account.isSystem) throw new BadRequestException('System accounts cannot be modified');
    return this.prisma.ledgerAccount.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');
    if (account.isSystem) throw new BadRequestException('System accounts cannot be deleted');
    return this.prisma.ledgerAccount.delete({ where: { id } });
  }
}
