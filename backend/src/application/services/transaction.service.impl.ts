import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateTransactionDTO, UpdateTransactionDTO } from '@easy-books/shared';

@Injectable()
export class TransactionServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.transaction.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.transaction.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateTransactionDTO) {
    return this.prisma.transaction.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateTransactionDTO) {
    return this.prisma.transaction.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.transaction.delete({ where: { id } });
  }
}
