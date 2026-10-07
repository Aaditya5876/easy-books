import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateMemoDocumentDTO, UpdateMemoDocumentDTO } from '@easy-books/shared';

@Injectable()
export class MemoServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.memoDocument.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.memoDocument.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async create(dto: CreateMemoDocumentDTO) {
    // title has no real equivalent in the category-based document form the frontend
    // uses — derive a sensible one server-side so the recycle bin still has something
    // meaningful to display, without requiring the frontend to invent a "title" concept.
    const title = dto.title || (dto as any).clientName || (dto as any).vendorName || dto.category || 'Document';
    return this.prisma.memoDocument.create({ data: { ...dto, title } as any });
  }

  async update(id: string, companyId: string, dto: UpdateMemoDocumentDTO) {
    const existing = await this.prisma.memoDocument.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Document not found');
    return this.prisma.memoDocument.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.memoDocument.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Document not found');
    return this.prisma.memoDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
