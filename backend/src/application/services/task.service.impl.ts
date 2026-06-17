import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateTaskDTO, UpdateTaskDTO } from '@easy-books/shared';

@Injectable()
export class TaskServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.task.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.task.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async create(dto: CreateTaskDTO) {
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    return this.prisma.task.create({ data: { ...dto, dueDate } as any });
  }

  async update(id: string, companyId: string, dto: UpdateTaskDTO) {
    return this.prisma.task.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
