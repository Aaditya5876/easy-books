import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateBankAccountDTO, UpdateBankAccountDTO } from '@easy-books/shared';

@Injectable()
export class BankAccountServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.bankAccount.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.bankAccount.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateBankAccountDTO) {
    return this.prisma.bankAccount.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateBankAccountDTO) {
    return this.prisma.bankAccount.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.bankAccount.delete({ where: { id } });
  }
}
