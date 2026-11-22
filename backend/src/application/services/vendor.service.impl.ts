import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { CreateVendorDTO, UpdateVendorDTO } from '@easy-books/shared';
import { LedgerPostingService } from './ledger-posting.service';
import { PartyStatementService } from './party-statement.service';

@Injectable()
export class VendorServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
    private readonly statements: PartyStatementService,
  ) {}

  // Each vendor carries its balance: opening + bills − payments − debit notes = what we still owe.
  async findAll(companyId: string) {
    const [vendors, balances] = await Promise.all([
      this.prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.statements.vendorBalances(companyId),
    ]);
    return vendors.map((v) => ({ ...v, balance: balances.get(v.id) }));
  }

  async findOne(id: string, companyId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  statement(id: string, companyId: string) {
    return this.statements.vendorStatement(companyId, id);
  }

  // The opening balance is posted with the vendor (DR Opening Balance Equity /
  // CR Accounts Payable), in the same transaction.
  async create(dto: CreateVendorDTO) {
    await assertTaskLink(this.prisma, dto.companyId, dto.taskId);
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({ data: dto as any });
      await this.ledgerPosting.postOpeningBalanceTx(tx, dto.companyId, {
        party: 'VENDOR', partyId: vendor.id, partyName: vendor.name, amount: Number(vendor.openingBalance), date: vendor.createdAt,
      });
      return vendor;
    });
  }

  async update(id: string, companyId: string, dto: UpdateVendorDTO) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    await assertTaskLink(this.prisma, companyId, dto.taskId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.update({ where: { id }, data: dto as any });
      if (dto.openingBalance !== undefined && Number(updated.openingBalance) !== Number(vendor.openingBalance)) {
        await this.ledgerPosting.postOpeningBalanceTx(tx, companyId, {
          party: 'VENDOR', partyId: id, partyName: updated.name, amount: Number(updated.openingBalance), date: vendor.createdAt,
        });
      }
      return updated;
    });
  }

  async remove(id: string, companyId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    // Deleting someone with money still owing would hide that balance from
    // the vendor list while it stays in the ledger.
    const due = (await this.statements.vendorBalances(companyId)).get(id)?.due ?? 0;
    if (Math.abs(due) > 0.005) {
      throw new BadRequestException(`Can't delete: we still owe ${vendor.name} NPR ${due.toLocaleString('en-IN')} — pay it (Purchase → Record Payment) before deleting`);
    }
    return this.prisma.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
