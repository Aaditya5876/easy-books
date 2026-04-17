import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateMemoDocumentDTO, UpdateMemoDocumentDTO } from '@easy-books/shared';

@Injectable()
export class MemoServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.memoDocument.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.memoDocument.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateMemoDocumentDTO) {
    return this.prisma.memoDocument.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateMemoDocumentDTO) {
    return this.prisma.memoDocument.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.memoDocument.delete({ where: { id } });
  }
}
