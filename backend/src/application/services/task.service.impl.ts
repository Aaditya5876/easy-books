import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/db/psql/prisma.client';
import { CreateTaskDTO, UpdateTaskDTO } from '@easy-books/shared';
import { nextTaskNumberTx } from '../../../core/utils/task-number';

// '' from a cleared form field means "no value", same as null.
const blankToNull = <T>(v: T) => (v === '' ? null : v);
const toDate = (v?: string | null) => (v ? new Date(v) : v === undefined ? undefined : null);
const n = (v: unknown) => Number(v ?? 0);
const round = (v: number) => Math.round(v * 100) / 100;

@Injectable()
export class TaskServiceImpl {
  constructor(private readonly prisma: PrismaService) {}

  // Each task carries how many bills/purchases/quotations/documents hang off
  // it, so the Workflow board can show that on the card without N calls.
  async findAll(companyId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            quotations: true,
            salesOrders: { where: { deletedAt: null } },
            purchaseOrders: { where: { deletedAt: null } },
          },
        },
      },
    });
    const docs = tasks.length
      ? await this.prisma.memoDocument.groupBy({
          by: ['referenceId'],
          where: { companyId, deletedAt: null, referenceId: { in: tasks.map((t) => t.id) } },
          _count: { _all: true },
        })
      : [];
    const docCount = new Map(docs.map((d) => [d.referenceId, d._count._all]));
    return tasks.map(({ _count, ...t }) => ({
      ...t,
      linkCounts: {
        quotations: _count.quotations,
        sales: _count.salesOrders,
        purchases: _count.purchaseOrders,
        documents: docCount.get(t.id) ?? 0,
      },
    }));
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.task.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async create(dto: CreateTaskDTO, assignedBy?: string) {
    await this.assertLinks(dto.companyId, dto);
    const data = this.clean(dto) as Prisma.TaskUncheckedCreateInput;
    // Next number per company, under the same lock bills use when they create
    // a job (nextTaskNumberTx) — two jobs can never get the same number.
    return this.prisma.$transaction(async (tx) => {
      const taskNumber = await nextTaskNumberTx(tx, dto.companyId);
      return tx.task.create({ data: { ...data, companyId: dto.companyId, assignedBy, taskNumber } });
    });
  }

  async update(id: string, companyId: string, dto: UpdateTaskDTO) {
    const task = await this.prisma.task.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertLinks(companyId, { partyType: task.partyType, ...dto } as UpdateTaskDTO);
    return this.prisma.task.update({ where: { id }, data: this.clean(dto) });
  }

  async remove(id: string, companyId: string) {
    const task = await this.prisma.task.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Everything connected to one job — the "connected flow":
  // quotation → purchases → sales bills → payments, plus the people and
  // documents involved, money totals and a dated timeline.
  async links(id: string, companyId: string) {
    const task = await this.prisma.task.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found');
    const linked = { companyId, taskId: id };

    const [quotations, sales, purchases, clients, vendors, employees, documents, assignedEmployee, party] = await Promise.all([
      this.prisma.quotation.findMany({
        where: linked,
        select: { id: true, quotationNumber: true, clientName: true, dateAd: true, totalAmount: true, remark: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.salesOrder.findMany({
        where: { ...linked, deletedAt: null },
        select: {
          id: true, invoiceNumber: true, clientName: true, dateAd: true, totalAmount: true, paidAmount: true, status: true, createdAt: true,
          payments: { select: { id: true, amount: true, paymentMethod: true, dateAd: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { ...linked, deletedAt: null },
        select: { id: true, orderNumber: true, vendorName: true, dateAd: true, totalAmount: true, paidAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.client.findMany({ where: { ...linked, deletedAt: null }, select: { id: true, name: true, phone: true, email: true, createdAt: true } }),
      this.prisma.vendor.findMany({ where: { ...linked, deletedAt: null }, select: { id: true, name: true, phone: true, email: true, createdAt: true } }),
      this.prisma.employee.findMany({ where: { ...linked, deletedAt: null }, select: { id: true, name: true, employeeId: true, designation: true, phone: true, createdAt: true } }),
      this.prisma.memoDocument.findMany({
        where: { companyId, referenceId: id, deletedAt: null },
        select: { id: true, category: true, title: true, documentUrl: true, attachments: true, dateAd: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      task.assignedEmployeeId
        ? this.prisma.employee.findFirst({ where: { id: task.assignedEmployeeId, companyId }, select: { id: true, name: true, employeeId: true, designation: true, phone: true } })
        : null,
      this.partyRecord(companyId, task.partyType, task.partyId),
    ]);

    const billed = sales.reduce((s, o) => s + n(o.totalAmount), 0);
    const received = sales.reduce((s, o) => s + n(o.paidAmount), 0);
    const purchaseCost = purchases.reduce((s, o) => s + n(o.totalAmount), 0);
    // Total value quoted to the customer for this job (converted or not).
    const quoted = quotations.reduce((s, q) => s + n(q.totalAmount), 0);

    type Event = { kind: string; id: string; at: Date; label: string; amount?: number; status?: string };
    const timeline: Event[] = [
      { kind: 'TASK_CREATED', id: task.id, at: task.createdAt, label: `#${task.taskNumber} ${task.title}` },
      ...quotations.map((q) => ({ kind: 'QUOTATION', id: q.id, at: q.createdAt, label: q.quotationNumber, amount: n(q.totalAmount), status: q.status })),
      ...purchases.map((p) => ({ kind: 'PURCHASE', id: p.id, at: p.createdAt, label: `${p.orderNumber} — ${p.vendorName}`, amount: n(p.totalAmount), status: p.status })),
      ...sales.map((o) => ({ kind: 'SALE', id: o.id, at: o.createdAt, label: `${o.invoiceNumber} — ${o.clientName}`, amount: n(o.totalAmount), status: o.status })),
      ...sales.flatMap((o) => o.payments.map((p) => ({ kind: 'PAYMENT', id: p.id, at: p.createdAt, label: `${o.invoiceNumber} · ${p.paymentMethod}`, amount: n(p.amount) }))),
      ...clients.map((c) => ({ kind: 'CLIENT', id: c.id, at: c.createdAt, label: c.name })),
      ...vendors.map((v) => ({ kind: 'VENDOR', id: v.id, at: v.createdAt, label: v.name })),
      ...employees.map((e) => ({ kind: 'EMPLOYEE', id: e.id, at: e.createdAt, label: e.name })),
      ...documents.map((d) => ({ kind: 'DOCUMENT', id: d.id, at: d.createdAt, label: d.title || d.category || 'Document' })),
    ];
    // Same-moment events keep the logical order (job first).
    const order = ['TASK_CREATED', 'CLIENT', 'VENDOR', 'EMPLOYEE', 'QUOTATION', 'PURCHASE', 'SALE', 'PAYMENT', 'DOCUMENT'];
    timeline.sort((a, b) => a.at.getTime() - b.at.getTime() || order.indexOf(a.kind) - order.indexOf(b.kind));

    const money = <T extends Record<string, unknown>>(rows: T[], keys: string[]) =>
      rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, n(r[k])])) }));

    return {
      task: { id: task.id, taskNumber: task.taskNumber, title: task.title },
      client: task.partyType === 'CLIENT' ? party : null,
      vendor: task.partyType === 'VENDOR' ? party : null,
      partyEmployee: task.partyType === 'EMPLOYEE' ? party : null,
      assignedEmployee,
      quotations: money(quotations, ['totalAmount']),
      sales: sales.map(({ payments, ...o }) => ({ ...o, totalAmount: n(o.totalAmount), paidAmount: n(o.paidAmount), payments: money(payments, ['amount']) })),
      purchases: money(purchases, ['totalAmount', 'paidAmount']),
      clients,
      vendors,
      employees,
      documents,
      summary: {
        quoted: round(quoted),
        billed: round(billed),
        received: round(received),
        outstanding: round(billed - received),
        purchaseCost: round(purchaseCost),
        margin: round(billed - purchaseCost),
      },
      timeline,
    };
  }

  private partyRecord(companyId: string, partyType?: string | null, partyId?: string | null) {
    if (!partyId) return Promise.resolve(null);
    const where = { id: partyId, companyId };
    if (partyType === 'CLIENT') return this.prisma.client.findFirst({ where, select: { id: true, name: true, phone: true, email: true } });
    if (partyType === 'VENDOR') return this.prisma.vendor.findFirst({ where, select: { id: true, name: true, phone: true, email: true } });
    if (partyType === 'EMPLOYEE') return this.prisma.employee.findFirst({ where, select: { id: true, name: true, phone: true, email: true } });
    return Promise.resolve(null);
  }

  // partyId / assignedEmployeeId come from the request: they must be this
  // company's records (and partyId must match partyType).
  private async assertLinks(companyId: string, dto: Pick<CreateTaskDTO, 'partyType' | 'partyId' | 'assignedEmployeeId'>) {
    if (dto.assignedEmployeeId) {
      const emp = await this.prisma.employee.findFirst({ where: { id: dto.assignedEmployeeId, companyId, deletedAt: null }, select: { id: true } });
      if (!emp) throw new BadRequestException('Assigned employee not found in this company');
    }
    if (dto.partyId) {
      if (!dto.partyType || dto.partyType === 'OTHER') throw new BadRequestException('partyId needs partyType CLIENT, VENDOR or EMPLOYEE');
      if (!(await this.partyRecord(companyId, dto.partyType, dto.partyId))) {
        throw new BadRequestException(`That ${dto.partyType.toLowerCase()} was not found in this company`);
      }
    }
  }

  // The validated DTO only holds known fields; this normalises blanks and dates.
  private clean(dto: CreateTaskDTO | UpdateTaskDTO): Prisma.TaskUncheckedUpdateInput {
    const { companyId: _ignored, ...rest } = dto as CreateTaskDTO;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) out[k] = blankToNull(v);
    }
    if ('dueDate' in rest) out.dueDate = toDate(blankToNull(rest.dueDate) as string | null);
    return out;
  }
}
