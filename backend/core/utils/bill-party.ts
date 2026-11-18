import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

interface PartyInput {
  id?: string | null;
  name?: string | null;
  contact?: string | null;
  address?: string | null;
  panVat?: string | null;
}

export interface ResolvedParty {
  id: string | null;
  name: string;
}

// Every bill should belong to its vendor/client record, so their balance and
// statement are complete:
//  1. an id from "Select saved vendor/client" must be this company's;
//  2. otherwise a typed name matching an existing one (any case/spaces) links to it;
//  3. otherwise a new record is created when `createIfMissing` (anyone we owe or
//     who owes us must be tracked) — a fully-paid walk-in sale stays unlinked.
async function resolveParty(
  model: 'vendor' | 'client',
  tx: Tx,
  companyId: string,
  input: PartyInput,
  createIfMissing: boolean,
): Promise<ResolvedParty> {
  const label = model === 'vendor' ? 'Vendor' : 'Client';
  const typedName = (input.name ?? '').trim().replace(/\s+/g, ' ');
  const delegate = (model === 'vendor' ? tx.vendor : tx.client) as unknown as {
    findFirst(args: unknown): Promise<{ id: string; name: string } | null>;
    create(args: unknown): Promise<{ id: string; name: string }>;
  };

  if (input.id) {
    const found = await delegate.findFirst({ where: { id: input.id, companyId, deletedAt: null }, select: { id: true, name: true } });
    if (!found) throw new BadRequestException(`${label} not found in this company`);
    return { id: found.id, name: typedName || found.name };
  }
  if (!typedName) throw new BadRequestException(`${label} name is required`);

  const match = await delegate.findFirst({
    where: { companyId, deletedAt: null, name: { equals: typedName, mode: 'insensitive' } },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (match) return { id: match.id, name: match.name };
  if (!createIfMissing) return { id: null, name: typedName };

  const created = await delegate.create({
    data: {
      companyId,
      name: typedName,
      phone: input.contact || undefined,
      address: input.address || undefined,
      panVat: input.panVat || undefined,
    },
    select: { id: true, name: true },
  });
  return created;
}

export const resolveVendorTx = (tx: Tx, companyId: string, input: PartyInput) =>
  resolveParty('vendor', tx, companyId, input, true);

export const resolveClientTx = (tx: Tx, companyId: string, input: PartyInput, createIfMissing: boolean) =>
  resolveParty('client', tx, companyId, input, createIfMissing);
