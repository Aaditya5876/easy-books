import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateLedgerAccountDTO, UpdateLedgerAccountDTO } from '@easy-books/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class LedgerAccountServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  // Normal list — hidden accounts are invisible
  async findAll(companyId: string) {
    return this.prisma.ledgerAccount.findMany({
      where: { companyId, isHidden: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
  }

  async create(dto: CreateLedgerAccountDTO) {
    return this.prisma.ledgerAccount.create({ data: dto as any });
  }

  async update(id: string, companyId: string, dto: UpdateLedgerAccountDTO) {
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');
    if (account.isSystem) throw new BadRequestException('System accounts cannot be modified');
    return this.prisma.ledgerAccount.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, companyId: string) {
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');
    if (account.isSystem) throw new BadRequestException('System accounts cannot be deleted');
    if (account.isHidden) throw new BadRequestException('Use the secure delete endpoint for hidden accounts');
    return this.prisma.ledgerAccount.delete({ where: { id } });
  }

  // ── Hidden account operations (ADMIN only, password required) ──────────────

  private async verifyAdminPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Incorrect password');
  }

  async toggleHidden(id: string, companyId: string, userId: string, password: string) {
    await this.verifyAdminPassword(userId, password);
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');
    if (account.isSystem) throw new BadRequestException('System accounts cannot be hidden');
    return this.prisma.ledgerAccount.update({
      where: { id },
      data: { isHidden: !account.isHidden },
    });
  }

  async findHiddenByName(accountName: string, companyId: string, userId: string, password: string) {
    await this.verifyAdminPassword(userId, password);
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, accountName: { contains: accountName, mode: 'insensitive' }, isHidden: true },
    });
    if (!account) throw new NotFoundException('No hidden account found with that name');
    return account;
  }

  async removeHidden(id: string, companyId: string, userId: string, password: string) {
    await this.verifyAdminPassword(userId, password);
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Ledger account not found');
    if (!account.isHidden) throw new BadRequestException('Account is not hidden — use normal delete');
    return this.prisma.ledgerAccount.delete({ where: { id } });
  }
}
