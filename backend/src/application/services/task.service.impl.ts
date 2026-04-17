import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateTaskDTO, UpdateTaskDTO } from '@easy-books/shared';

@Injectable()
export class TaskServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.task.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.task.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateTaskDTO) {
    return this.prisma.task.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateTaskDTO) {
    return this.prisma.task.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.task.delete({ where: { id } });
  }
}
