import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { assertTaskLink } from '../../../core/utils/task-link';
import { CreateClientDTO, UpdateClientDTO } from '@easy-books/shared';
import { LedgerPostingService } from './ledger-posting.service';
import { PartyStatementService } from './party-statement.service';

@Injectable()
export class ClientServiceImpl {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerPosting: LedgerPostingService,
    private readonly statements: PartyStatementService,
  ) {}

  // Each client carries its balance: opening + bills − payments − credit notes = what they still owe.
  async findAll(companyId: string) {
    const [clients, balances] = await Promise.all([
      this.prisma.client.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.statements.clientBalances(companyId),
    ]);
    return clients.map((c) => ({ ...c, balance: balances.get(c.id) }));
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  statement(id: string, companyId: string) {
    return this.statements.clientStatement(companyId, id);
  }

  // The opening balance is posted with the client (DR Accounts Receivable /
  // CR Opening Balance Equity), in the same transaction.
  async create(dto: CreateClientDTO) {
    await assertTaskLink(this.prisma, dto.companyId, dto.taskId);
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({ data: dto as any });
      await this.ledgerPosting.postOpeningBalanceTx(tx, dto.companyId, {
        party: 'CLIENT', partyId: client.id, partyName: client.name, amount: Number(client.openingBalance), date: client.createdAt,
      });
      return client;
    });
  }

  async update(id: string, companyId: string, dto: UpdateClientDTO) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    await assertTaskLink(this.prisma, companyId, dto.taskId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({ where: { id }, data: dto as any });
      if (dto.openingBalance !== undefined && Number(updated.openingBalance) !== Number(client.openingBalance)) {
        await this.ledgerPosting.postOpeningBalanceTx(tx, companyId, {
          party: 'CLIENT', partyId: id, partyName: updated.name, amount: Number(updated.openingBalance), date: client.createdAt,
        });
      }
      return updated;
    });
  }

  async remove(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    // Deleting someone with money still owing would hide that balance from
    // the client list while it stays in the ledger.
    const due = (await this.statements.clientBalances(companyId)).get(id)?.due ?? 0;
    if (Math.abs(due) > 0.005) {
      throw new BadRequestException(`Can't delete: ${client.name} still owes NPR ${due.toLocaleString('en-IN')} — receive it (Sales → Receive Payment) before deleting`);
    }
    return this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
