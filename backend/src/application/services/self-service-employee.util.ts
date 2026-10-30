import { PrismaService } from '../../../core/db/psql/prisma.client';

// Shared by every "self-service" feature (attendance check-in/out, leave
// requests, ...) that needs to map a logged-in User to their Employee record.
// There is no explicit User<->Employee foreign key in the schema, so the link
// is inferred by matching email (case-insensitive) — keep an employee's email
// in sync with their login email for these features to find them.
export async function resolveLinkedEmployee(prisma: PrismaService, companyId: string, email: string) {
  const employee = await prisma.employee.findFirst({
    where: { companyId, status: 'ACTIVE', email: { equals: email, mode: 'insensitive' } },
  });
  if (employee) return employee;

  // Logins created before every path ensured an Employee row (e.g. the first
  // ADMIN from provisionClient) get one on first self-service use. Only for a
  // real member of this company, and never when a row already exists but is
  // inactive or deleted — that's an admin's decision, not a gap to fill.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, userCompanies: { some: { companyId } } },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return null;
  const any = await prisma.employee.findFirst({
    where: { companyId, email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (any) return null;
  return ensureEmployeeRecord(prisma, companyId, user);
}

// Every non-SUPER_ADMIN login gets an Employee row in its company so
// attendance, leave and payroll have someone to attach to.
export async function ensureEmployeeRecord(
  prisma: PrismaService,
  companyId: string,
  user: { id: string; name: string; email: string; role: string },
) {
  if (user.role === 'SUPER_ADMIN') return null;
  const existing = await prisma.employee.findFirst({
    where: { companyId, email: { equals: user.email, mode: 'insensitive' }, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.employee.create({
    data: {
      companyId,
      name: user.name,
      email: user.email,
      employeeId: `USER-${user.id}`,
      designation: user.role === 'TEACHER' ? 'Teacher' : user.role,
    },
  });
}
