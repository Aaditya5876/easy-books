import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/db/psql/prisma.client';

// Next EMP-#### after the highest existing one in the company (not the count,
// so gaps and typed numbers never clash). The ID is internal — the screens
// don't show it — but stays unique per company.
export async function nextEmployeeId(prisma: PrismaService, companyId: string): Promise<string> {
  const rows = await prisma.employee.findMany({
    where: { companyId, employeeId: { startsWith: 'EMP-', mode: 'insensitive' } },
    select: { employeeId: true },
  });
  const max = rows.reduce((m, r) => Math.max(m, Number(/^EMP-(\d+)$/i.exec(r.employeeId)?.[1] ?? 0)), 0);
  return `EMP-${String(max + 1).padStart(4, '0')}`;
}

// Runs `create` with the next free number, retrying if a simultaneous save took it.
export async function createWithEmployeeId<T>(prisma: PrismaService, companyId: string, create: (employeeId: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await create(await nextEmployeeId(prisma, companyId));
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') || attempt >= 4) throw err;
    }
  }
}

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
  // The login's ROLE (Admin/Accountant/Staff) is an app permission, not a job
  // title — the designation is left for HR to fill (it used to say "ADMIN").
  // A teacher's job title really is Teacher.
  return createWithEmployeeId(prisma, companyId, (employeeId) => prisma.employee.create({
    data: {
      companyId,
      name: user.name,
      email: user.email,
      employeeId,
      designation: user.role === 'TEACHER' ? 'Teacher' : null,
    },
  }));
}
