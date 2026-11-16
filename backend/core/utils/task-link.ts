import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../db/psql/prisma.client';

type TaskReader = Pick<PrismaService, 'task'>;

// A record (bill, purchase, quotation, client, vendor, employee) may name the
// Workflow job it belongs to. The id comes from the request, so confirm the
// job is this company's — otherwise anyone could attach records to, and read
// them through, another company's job.
export async function assertTaskLink(prisma: TaskReader, companyId: string, taskId?: string | null) {
  if (!taskId) return;
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId, deletedAt: null }, select: { id: true } });
  if (!task) throw new BadRequestException('The linked Workflow task was not found in this company');
}
