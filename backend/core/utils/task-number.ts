import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// Next per-company Workflow job number ("#12"). A transaction-scoped advisory
// lock serialises every caller (the Workflow page and "create a job with this
// bill"), so two jobs can never get the same number and a bill's transaction
// never fails on the unique (companyId, taskNumber) index.
export async function nextTaskNumberTx(tx: Tx, companyId: string): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`task-number:${companyId}`}))`;
  const last = await tx.task.aggregate({ where: { companyId }, _max: { taskNumber: true } });
  return (last._max.taskNumber ?? 0) + 1;
}

interface BillJob {
  kind: 'PURCHASE' | 'SALE';
  number: string;
  partyType: 'VENDOR' | 'CLIENT';
  partyId: string | null;
  partyName: string;
  partyContact?: string | null;
  items: { description: string; quantity: number | string }[];
  totalAmount: number;
}

// "Also create a workflow job" on a purchase/sales bill: a job filled from the
// bill, created inside the bill's own transaction (both saved, or neither).
export async function createBillJobTx(tx: Tx, companyId: string, job: BillJob): Promise<string> {
  const taskNumber = await nextTaskNumberTx(tx, companyId);
  const title = `${job.kind === 'PURCHASE' ? 'Purchase' : 'Sale'} ${job.number} — ${job.partyName}`;
  const description = [
    ...job.items.map((i) => `${Number(i.quantity)} × ${i.description}`),
    `Total: NPR ${job.totalAmount.toLocaleString('en-IN')}`,
  ].join('\n');
  const task = await tx.task.create({
    data: {
      companyId,
      taskNumber,
      title,
      description,
      workflowType: 'GENERAL',
      partyType: job.partyType,
      partyId: job.partyId,
      partyName: job.partyName,
      partyContact: job.partyContact || null,
      status: 'PENDING',
    },
    select: { id: true },
  });
  return task.id;
}
