import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateMemoDocumentDTO, UpdateMemoDocumentDTO } from '@easy-books/shared';

// The Memo form sends plain YYYY-MM-DD dates ('' for blank ones); the
// columns are DateTime, which rejected them — no document could be saved.
const DATE_FIELDS = ['dateAd', 'startDate', 'endDate', 'deliveryDate', 'dueDate', 'validUntil'];
function withDates<T extends object>(dto: T): T {
  const out: any = { ...dto };
  for (const k of DATE_FIELDS) {
    if (out[k] === undefined) continue;
    out[k] = out[k] === '' || out[k] === null ? null : new Date(out[k]);
  }
  return out;
}

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
    return this.prisma.memoDocument.create({ data: { ...withDates(dto), title } as any });
  }

  async update(id: string, companyId: string, dto: UpdateMemoDocumentDTO) {
    const existing = await this.prisma.memoDocument.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Document not found');
    return this.prisma.memoDocument.update({ where: { id }, data: withDates(dto) as any });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.memoDocument.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Document not found');
    return this.prisma.memoDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
