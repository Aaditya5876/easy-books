import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateClientDTO, UpdateClientDTO } from '@easy-books/shared';

@Injectable()
export class ClientServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.client.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(dto: CreateClientDTO) {
    return this.prisma.client.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateClientDTO) {
    return this.prisma.client.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId } });
    if (!client) throw new NotFoundException('Client not found');

    const hasOrders = await this.prisma.salesOrder.findFirst({ where: { clientId: id } });
    if (hasOrders) {
      throw new BadRequestException('Cannot delete client with existing sales orders');
    }

    const hasQuotations = await this.prisma.quotation.findFirst({ where: { clientId: id } });
    if (hasQuotations) {
      throw new BadRequestException('Cannot delete client with existing quotations');
    }

    return this.prisma.client.delete({ where: { id } });
  }
}
