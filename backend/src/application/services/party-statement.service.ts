import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { adToBs } from '@easy-books/shared';

type PartyKind = 'VENDOR' | 'CLIENT';
type LineType = 'OPENING' | 'BILL' | 'PAYMENT' | 'RETURN';

export interface PartyBalance {
  openingBalance: number;
  billed: number;
  paid: number;
  returns: number; // debit notes (vendor) / credit notes (client)
  due: number; // we owe the vendor / the client owes us
}

export interface StatementLine {
  date: Date;
  dateBs: string | null;
  type: LineType;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
}

const n = (v: unknown) => Number(v ?? 0);
const round = (v: number) => Math.round(v * 100) / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);

// How much each vendor/client is owed or owes, and the running statement
// behind it — read from the bills, payments and notes linked to that party:
//   vendor: opening + purchase bills − payments made − debit notes   (Cr side = we owe)
//   client: opening + sales bills − payments received − credit notes (Dr side = they owe)
// Deleted bills (and their payments) are left out.
@Injectable()
export class PartyStatementService {
  constructor(private readonly prisma: PrismaService) {}

  async vendorBalances(companyId: string): Promise<Map<string, PartyBalance>> {
    const [vendors, bills, notes] = await Promise.all([
      this.prisma.vendor.findMany({ where: { companyId, deletedAt: null }, select: { id: true, openingBalance: true } }),
      this.prisma.purchaseOrder.groupBy({
        by: ['vendorId'], where: { companyId, deletedAt: null, vendorId: { not: null } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.debitNote.groupBy({ by: ['vendorId'], where: { companyId, vendorId: { not: null } }, _sum: { amount: true } }),
    ]);
    return this.toBalances(vendors, bills.map((b) => ({ id: b.vendorId, ...b._sum })), notes.map((x) => ({ id: x.vendorId, amount: x._sum.amount })));
  }

  async clientBalances(companyId: string): Promise<Map<string, PartyBalance>> {
    const [clients, bills, notes] = await Promise.all([
      this.prisma.client.findMany({ where: { companyId, deletedAt: null }, select: { id: true, openingBalance: true } }),
      this.prisma.salesOrder.groupBy({
        by: ['clientId'], where: { companyId, deletedAt: null, clientId: { not: null } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.creditNote.groupBy({ by: ['clientId'], where: { companyId, clientId: { not: null } }, _sum: { amount: true } }),
    ]);
    return this.toBalances(clients, bills.map((b) => ({ id: b.clientId, ...b._sum })), notes.map((x) => ({ id: x.clientId, amount: x._sum.amount })));
  }

  async vendorStatement(companyId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id: vendorId, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const [bills, payments, notes] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { companyId, vendorId, deletedAt: null },
        select: { orderNumber: true, dateAd: true, dateBs: true, totalAmount: true, createdAt: true, _count: { select: { items: true } } },
      }),
      this.prisma.payment.findMany({
        where: { companyId, purchaseOrder: { vendorId, deletedAt: null } },
        select: { amount: true, paymentMethod: true, referenceNumber: true, dateAd: true, dateBs: true, createdAt: true, purchaseOrder: { select: { orderNumber: true } } },
      }),
      this.prisma.debitNote.findMany({
        where: { companyId, vendorId },
        select: { debitNoteNumber: true, reason: true, amount: true, dateAd: true, dateBs: true, createdAt: true },
      }),
    ]);
    const rows = [
      ...bills.map((b) => ({ type: 'BILL' as const, date: b.dateAd, dateBs: b.dateBs, createdAt: b.createdAt, reference: b.orderNumber, description: `Purchase bill (${b._count.items} items)`, amount: n(b.totalAmount) })),
      ...payments.map((p) => ({ type: 'PAYMENT' as const, date: p.dateAd, dateBs: p.dateBs, createdAt: p.createdAt, reference: p.purchaseOrder?.orderNumber ?? null, description: `Payment made — ${methodLabel(p.paymentMethod)}${p.referenceNumber ? ` (${p.referenceNumber})` : ''}`, amount: n(p.amount) })),
      ...notes.map((x) => ({ type: 'RETURN' as const, date: x.dateAd, dateBs: x.dateBs, createdAt: x.createdAt, reference: x.debitNoteNumber, description: `Debit note — ${x.reason}`, amount: n(x.amount) })),
    ];
    return this.build('VENDOR', vendor, rows);
  }

  async clientStatement(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, companyId, deletedAt: null } });
    if (!client) throw new NotFoundException('Client not found');
    const [bills, payments, notes] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: { companyId, clientId, deletedAt: null },
        select: { invoiceNumber: true, dateAd: true, dateBs: true, totalAmount: true, createdAt: true, _count: { select: { items: true } } },
      }),
      this.prisma.payment.findMany({
        where: { companyId, salesOrder: { clientId, deletedAt: null } },
        select: { amount: true, paymentMethod: true, referenceNumber: true, dateAd: true, dateBs: true, createdAt: true, salesOrder: { select: { invoiceNumber: true } } },
      }),
      this.prisma.creditNote.findMany({
        where: { companyId, clientId },
        select: { creditNoteNumber: true, reason: true, amount: true, dateAd: true, dateBs: true, createdAt: true },
      }),
    ]);
    const rows = [
      ...bills.map((b) => ({ type: 'BILL' as const, date: b.dateAd, dateBs: b.dateBs, createdAt: b.createdAt, reference: b.invoiceNumber, description: `Sales bill (${b._count.items} items)`, amount: n(b.totalAmount) })),
      ...payments.map((p) => ({ type: 'PAYMENT' as const, date: p.dateAd, dateBs: p.dateBs, createdAt: p.createdAt, reference: p.salesOrder?.invoiceNumber ?? null, description: `Payment received — ${methodLabel(p.paymentMethod)}${p.referenceNumber ? ` (${p.referenceNumber})` : ''}`, amount: n(p.amount) })),
      ...notes.map((x) => ({ type: 'RETURN' as const, date: x.dateAd, dateBs: x.dateBs, createdAt: x.createdAt, reference: x.creditNoteNumber, description: `Credit note — ${x.reason}`, amount: n(x.amount) })),
    ];
    return this.build('CLIENT', client, rows);
  }

  private toBalances(
    parties: { id: string; openingBalance: unknown }[],
    bills: { id: string | null; totalAmount: unknown; paidAmount: unknown }[],
    notes: { id: string | null; amount: unknown }[],
  ) {
    const billBy = new Map(bills.map((b) => [b.id, b]));
    const noteBy = new Map(notes.map((x) => [x.id, n(x.amount)]));
    return new Map(parties.map((p) => {
      const openingBalance = round(n(p.openingBalance));
      const billed = round(n(billBy.get(p.id)?.totalAmount));
      const paid = round(n(billBy.get(p.id)?.paidAmount));
      const returns = round(noteBy.get(p.id) ?? 0);
      return [p.id, { openingBalance, billed, paid, returns, due: round(openingBalance + billed - paid - returns) }];
    }));
  }

  // Vendor statement: what we owe goes on the Credit side; client statement:
  // what they owe goes on the Debit side — the same sides the ledger uses for
  // Accounts Payable / Receivable. The opening balance is always the first line.
  private build(
    kind: PartyKind,
    party: { id: string; name: string; openingBalance: unknown; createdAt: Date },
    rows: { type: LineType; date: Date; dateBs: string | null; createdAt: Date; reference: string | null; description: string; amount: number }[],
  ) {
    const increasesBalance = (type: LineType) => type === 'OPENING' || type === 'BILL';
    const owedSide: 'debit' | 'credit' = kind === 'VENDOR' ? 'credit' : 'debit';
    const otherSide = owedSide === 'debit' ? 'credit' : 'debit';

    const opening = round(n(party.openingBalance));
    const sorted = [...rows].sort((a, b) => day(a.date).localeCompare(day(b.date)) || a.createdAt.getTime() - b.createdAt.getTime());
    const all = [
      ...(opening > 0 ? [{ type: 'OPENING' as const, date: party.createdAt, dateBs: adToBs(party.createdAt), createdAt: party.createdAt, reference: null, description: 'Opening balance', amount: opening }] : []),
      ...sorted,
    ];

    let balance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const lines: StatementLine[] = all.map((r) => {
      const side = increasesBalance(r.type) ? owedSide : otherSide;
      const debit = side === 'debit' ? round(r.amount) : 0;
      const credit = side === 'credit' ? round(r.amount) : 0;
      balance = round(balance + (increasesBalance(r.type) ? r.amount : -r.amount));
      totalDebit += debit;
      totalCredit += credit;
      return { date: r.date, dateBs: r.dateBs, type: r.type, description: r.description, reference: r.reference, debit, credit, balance };
    });

    return {
      party: { id: party.id, name: party.name, kind },
      lines,
      totals: { debit: round(totalDebit), credit: round(totalCredit) },
      closingBalance: balance,
    };
  }
}

function methodLabel(method: string) {
  return ({ CASH: 'Cash', BANK_TRANSFER: 'Bank', CHEQUE: 'Cheque', QR: 'QR / Wallet', CREDIT: 'Credit' } as Record<string, string>)[method] ?? method;
}
