import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateCompanyDTO, UpdateCompanyDTO } from '@easy-books/shared';

@Injectable()
export class CompanyServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.company.findFirst({ where: { id } });
  }

  async create(dto: CreateCompanyDTO) {
    return this.prisma.company.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateCompanyDTO) {
    return this.prisma.company.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    return this.prisma.company.delete({ where: { id } });
  }
}
