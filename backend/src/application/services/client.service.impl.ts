import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateClientDTO, UpdateClientDTO } from '@easy-books/shared';

@Injectable()
export class ClientServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.client.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.client.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateClientDTO) {
    return this.prisma.client.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateClientDTO) {
    return this.prisma.client.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.client.delete({ where: { id } });
  }
}
