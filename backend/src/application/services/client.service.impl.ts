import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { CreateClientDTO, UpdateClientDTO } from '@easy-books/shared';

@Injectable()
export class ClientServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.client.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(dto: CreateClientDTO) {
    await assertTaskLink(this.prisma, dto.companyId, dto.taskId);
    return this.prisma.client.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateClientDTO) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    await assertTaskLink(this.prisma, companyId, dto.taskId);
    return this.prisma.client.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    return this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
