import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import {
  AddSpaceChargeSchema, BulkSpacesSchema, CloseSpaceSessionSchema, CreateSpaceSchema, StartSpaceSessionSchema, UpdateSpaceSchema,
} from '@easy-books/shared';
import { SalesServiceImpl } from './sales.service.impl';

type CreateSpace = z.infer<typeof CreateSpaceSchema>;
type UpdateSpace = z.infer<typeof UpdateSpaceSchema>;
type BulkSpaces = z.infer<typeof BulkSpacesSchema>;
type StartSession = z.infer<typeof StartSpaceSessionSchema>;
type AddCharge = z.infer<typeof AddSpaceChargeSchema>;
type CloseSession = z.infer<typeof CloseSpaceSessionSchema>;

const n = (v: unknown) => Number(v ?? 0);
const round = (v: number) => Math.round(v * 100) / 100;
const ACTIVE: ('RESERVED' | 'OPEN')[] = ['RESERVED', 'OPEN'];
const UNIT_WORD = { NIGHT: 'night', DAY: 'day', HOUR: 'hour', VISIT: 'visit' } as const;
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const optDate = (v?: string | null) => (v ? new Date(v) : null);

// Rooms (hotel), tables (restaurant), beds (clinic), chairs (salon)… A
// session is one stay / sitting; closing it bills its charges (plus the
// space's time rate) as a normal SalesOrder through SalesServiceImpl.
@Injectable()
export class SpaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesServiceImpl,
  ) {}

  // ── Spaces ───────────────────────────────────────────────────────────────

  async list(companyId: string) {
    const spaces = await this.prisma.space.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        sessions: {
          where: { status: { in: ACTIVE } },
          take: 1,
          include: { charges: { select: { quantity: true, unitPrice: true } } },
        },
      },
    });
    return spaces.map(({ sessions, ...s }) => {
      const cur = sessions[0];
      return {
        ...s,
        rate: s.rate === null ? null : n(s.rate),
        session: cur ? {
          id: cur.id, status: cur.status, guestName: cur.guestName, guestContact: cur.guestContact, guests: cur.guests,
          startedAt: cur.startedAt, reservedFor: cur.reservedFor,
          chargesTotal: round(cur.charges.reduce((sum, c) => sum + n(c.quantity) * n(c.unitPrice), 0)),
        } : null,
      };
    });
  }

  private fields(dto: Partial<CreateSpace>) {
    const out: Record<string, unknown> = {};
    for (const k of ['name', 'type', 'capacity', 'rate', 'rateUnit', 'notes', 'sortOrder'] as const) {
      if (dto[k] !== undefined) out[k] = dto[k];
    }
    return out;
  }

  async create(companyId: string, dto: CreateSpace) {
    try {
      return await this.prisma.space.create({ data: { companyId, ...this.fields(dto) } as Prisma.SpaceUncheckedCreateInput });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException(`"${dto.name}" already exists`);
      throw e;
    }
  }

  async bulkCreate(companyId: string, dto: BulkSpaces) {
    const names = [...new Map(dto.names.map((nm) => [nm.trim().toLowerCase(), nm.trim()])).values()];
    const res = await this.prisma.space.createMany({
      data: names.map((name, i) => ({
        companyId, name, type: dto.type, sortOrder: i,
        capacity: dto.capacity ?? null, rate: dto.rate ?? null, rateUnit: dto.rateUnit ?? null,
      })),
      skipDuplicates: true,
    });
    return { created: res.count };
  }

  private async findSpace(id: string, companyId: string) {
    const space = await this.prisma.space.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async update(id: string, companyId: string, dto: UpdateSpace) {
    await this.findSpace(id, companyId);
    try {
      return await this.prisma.space.update({ where: { id }, data: this.fields(dto) });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException(`"${dto.name}" already exists`);
      throw e;
    }
  }

  async remove(id: string, companyId: string) {
    const space = await this.findSpace(id, companyId);
    if (space.status === 'OCCUPIED' || space.status === 'RESERVED') {
      throw new BadRequestException('Close or cancel what is in this space first');
    }
    // Soft delete; free the name so a new space can use it.
    return this.prisma.space.update({ where: { id }, data: { deletedAt: new Date(), name: `${space.name}~deleted~${id.slice(0, 8)}` } });
  }

  // FREE / CLEANING / OUT_OF_SERVICE by hand — never while in use.
  async setStatus(id: string, companyId: string, status: 'FREE' | 'CLEANING' | 'OUT_OF_SERVICE') {
    const res = await this.prisma.space.updateMany({
      where: { id, companyId, deletedAt: null, status: { in: ['FREE', 'CLEANING', 'OUT_OF_SERVICE'] } },
      data: { status },
    });
    if (res.count === 0) {
      await this.findSpace(id, companyId);
      throw new BadRequestException('This space is in use — close or cancel it first');
    }
    return { id, status };
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  async startSession(spaceId: string, companyId: string, dto: StartSession, createdBy?: string) {
    const occupy = dto.mode === 'OCCUPY';
    return this.prisma.$transaction(async (tx) => {
      // Claim the space: only one of several simultaneous clicks wins.
      const claimed = await tx.space.updateMany({
        where: { id: spaceId, companyId, deletedAt: null, status: 'FREE' },
        data: { status: occupy ? 'OCCUPIED' : 'RESERVED' },
      });
      if (claimed.count === 0) {
        const exists = await tx.space.findFirst({ where: { id: spaceId, companyId, deletedAt: null }, select: { status: true } });
        if (!exists) throw new NotFoundException('Space not found');
        throw new ConflictException(`This space is ${exists.status.toLowerCase().replace(/_/g, ' ')}, not free`);
      }
      return tx.spaceSession.create({
        data: {
          companyId, spaceId, createdBy,
          status: occupy ? 'OPEN' : 'RESERVED',
          guestName: dto.guestName.trim(),
          guestContact: dto.guestContact?.trim() || null,
          guests: dto.guests ?? null,
          reservedFor: optDate(dto.reservedFor),
          expectedEnd: optDate(dto.expectedEnd),
          startedAt: occupy ? new Date() : null,
          notes: dto.notes || null,
        },
      });
    });
  }

  private async findSession(id: string, companyId: string) {
    const s = await this.prisma.spaceSession.findFirst({ where: { id, companyId }, include: { space: true, charges: { orderBy: { createdAt: 'asc' } } } });
    if (!s) throw new NotFoundException('Not found');
    return s;
  }

  async checkIn(id: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.spaceSession.updateMany({ where: { id, companyId, status: 'RESERVED' }, data: { status: 'OPEN', startedAt: new Date() } });
      if (res.count === 0) throw new BadRequestException('Only a reservation can be checked in');
      const s = await tx.spaceSession.findUniqueOrThrow({ where: { id } });
      await tx.space.update({ where: { id: s.spaceId }, data: { status: 'OCCUPIED' } });
      return s;
    });
  }

  async cancel(id: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.spaceSession.updateMany({ where: { id, companyId, status: { in: ACTIVE } }, data: { status: 'CANCELLED', endedAt: new Date() } });
      if (res.count === 0) throw new BadRequestException('Nothing open to cancel');
      const s = await tx.spaceSession.findUniqueOrThrow({ where: { id } });
      await tx.space.update({ where: { id: s.spaceId }, data: { status: 'FREE' } });
      return s;
    });
  }

  async addCharge(sessionId: string, companyId: string, dto: AddCharge) {
    const s = await this.findSession(sessionId, companyId);
    if (s.status !== 'OPEN') throw new BadRequestException('Charges can be added only while it is open');
    let description = dto.description?.trim();
    let unitPrice = dto.unitPrice;
    if (dto.inventoryItemId) {
      const item = await this.prisma.inventoryItem.findFirst({ where: { id: dto.inventoryItemId, companyId, deletedAt: null } });
      if (!item) throw new BadRequestException('Stock item not found');
      description ||= item.itemName || item.partNumber || 'Item';
      unitPrice ??= n(item.unitSellingPrice);
    }
    return this.prisma.spaceCharge.create({
      data: { companyId, sessionId, description: description!, quantity: dto.quantity, unitPrice: unitPrice ?? 0, inventoryItemId: dto.inventoryItemId ?? null },
    });
  }

  async removeCharge(sessionId: string, chargeId: string, companyId: string) {
    const s = await this.findSession(sessionId, companyId);
    if (s.status !== 'OPEN') throw new BadRequestException('Charges can be changed only while it is open');
    const res = await this.prisma.spaceCharge.deleteMany({ where: { id: chargeId, sessionId, companyId } });
    if (res.count === 0) throw new NotFoundException('Charge not found');
    return { removed: true };
  }

  // Nights / days / hours since check-in (rounded up, at least 1), × rate.
  private timeCharge(space: { type: string; name: string; rate: unknown; rateUnit: keyof typeof UNIT_WORD | null }, startedAt: Date | null, quantityOverride?: number) {
    if (!space.rate || n(space.rate) <= 0 || !space.rateUnit || !startedAt) return null;
    const ms = Date.now() - startedAt.getTime();
    const per = space.rateUnit === 'HOUR' ? 3_600_000 : 86_400_000;
    const computed = space.rateUnit === 'VISIT' ? 1 : Math.max(1, Math.ceil(ms / per));
    const quantity = quantityOverride ?? computed;
    return {
      quantity,
      computedQuantity: computed,
      unitPrice: n(space.rate),
      description: `${space.type} ${space.name} — ${quantity} ${UNIT_WORD[space.rateUnit]}(s)`,
      amount: round(quantity * n(space.rate)),
    };
  }

  async get(id: string, companyId: string) {
    const s = await this.findSession(id, companyId);
    const charges = s.charges.map((c) => ({ ...c, quantity: n(c.quantity), unitPrice: n(c.unitPrice), amount: round(n(c.quantity) * n(c.unitPrice)) }));
    const chargesTotal = round(charges.reduce((sum, c) => sum + c.amount, 0));
    const timeCharge = s.status === 'OPEN' ? this.timeCharge(s.space as any, s.startedAt) : null;
    return { ...s, space: { ...s.space, rate: s.space.rate === null ? null : n(s.space.rate) }, charges, chargesTotal, timeCharge, total: round(chargesTotal + (timeCharge?.amount ?? 0)) };
  }

  history(companyId: string, spaceId?: string) {
    return this.prisma.spaceSession.findMany({
      where: { companyId, ...(spaceId ? { spaceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { space: { select: { name: true, type: true } }, salesOrder: { select: { invoiceNumber: true, totalAmount: true, status: true } } },
    });
  }

  // Bill and close. The bill, its stock/ledger, closing the session and
  // freeing the space are one transaction (via SalesServiceImpl.create's
  // inTx hook) — so a failure leaves the space open with nothing billed, and
  // two simultaneous "close" clicks make one bill.
  async close(id: string, companyId: string, dto: CloseSession) {
    const s = await this.findSession(id, companyId);
    if (s.status !== 'OPEN') throw new BadRequestException('Only an open session can be closed');
    const nextStatus = dto.nextStatus ?? 'CLEANING';
    const time = dto.includeTimeCharge === false ? null : this.timeCharge(s.space as any, s.startedAt, dto.timeQuantity);
    const items = [
      ...s.charges.map((c) => ({
        ...(c.inventoryItemId ? { inventoryItemId: c.inventoryItemId } : {}),
        description: c.description, quantity: n(c.quantity), unitPrice: n(c.unitPrice), discountPercent: 0,
      })),
      ...(time && time.quantity > 0 ? [{ description: time.description, quantity: time.quantity, unitPrice: time.unitPrice, discountPercent: 0 }] : []),
    ];

    const finish = async (tx: Prisma.TransactionClient, salesOrderId: string | null) => {
      const claimed = await tx.spaceSession.updateMany({
        where: { id, companyId, status: 'OPEN' },
        data: { status: 'CLOSED', endedAt: new Date(), salesOrderId },
      });
      if (claimed.count === 0) throw new BadRequestException('Already closed');
      await tx.space.update({ where: { id: s.spaceId }, data: { status: nextStatus } });
    };

    if (items.length === 0) {
      await this.prisma.$transaction((tx) => finish(tx, null));
      return { salesOrderId: null, invoiceNumber: null, totalAmount: 0 };
    }

    const paymentMethod = dto.paymentMethod ?? 'CASH';
    const order = await this.sales.create({
      companyId,
      clientName: s.guestName,
      clientContact: s.guestContact ?? undefined,
      dateAd: new Date().toISOString().slice(0, 10),
      isVat: !!dto.isVat,
      paymentMethod,
      notes: `${s.space.type} ${s.space.name} — ${s.guestName}`,
      items,
    } as any, (tx, created) => finish(tx, created.id));

    // Paid at checkout (not on credit): record it. If that fails the bill
    // stays as an unpaid receivable and can be paid from Sales.
    let paid = false;
    if (paymentMethod !== 'CREDIT') {
      try {
        await this.sales.recordPayment({
          companyId, salesOrderId: order.id, amount: n(order.totalAmount), paymentMethod,
          dateAd: new Date().toISOString().slice(0, 10), notes: `Checkout — ${s.space.type} ${s.space.name}`,
        } as any);
        paid = true;
      } catch { /* left unpaid */ }
    }
    return { salesOrderId: order.id, invoiceNumber: (order as any).invoiceNumber, totalAmount: n(order.totalAmount), paid };
  }
}
