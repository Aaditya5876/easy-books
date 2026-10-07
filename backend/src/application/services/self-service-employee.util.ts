import { PrismaService } from '../../../core/db/psql/prisma.client';

// Shared by every "self-service" feature (attendance check-in/out, leave
// requests, ...) that needs to map a logged-in User to their Employee record.
// There is no explicit User<->Employee foreign key in the schema, so the link
// is inferred by matching email (case-insensitive) — keep an employee's email
// in sync with their login email for these features to find them.
export async function resolveLinkedEmployee(prisma: PrismaService, companyId: string, email: string) {
  return prisma.employee.findFirst({
    where: { companyId, status: 'ACTIVE', email: { equals: email, mode: 'insensitive' } },
  });
}
