import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

// Shared by AuthServiceImpl (unauthenticated login-page quick action) and
// AttendanceServiceImpl (authenticated in-app "My Attendance" page) so both
// entry points mark attendance identically. Self-service links to an
// Employee purely by matching email (case-insensitive) against the logged-in
// User's email — there is no explicit User<->Employee foreign key in the
// schema, so an employee's record must have its email kept in sync with
// their login email for self check-in/out to find them.

function todayDateOnly(): Date {
  return new Date(new Date().toISOString().split('T')[0]);
}

function nowTime(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

async function findLinkedEmployee(prisma: PrismaService, companyId: string, email: string) {
  return prisma.employee.findFirst({
    where: { companyId, status: 'ACTIVE', email: { equals: email, mode: 'insensitive' } },
  });
}

export async function getSelfAttendanceToday(prisma: PrismaService, companyId: string, email: string) {
  const employee = await findLinkedEmployee(prisma, companyId, email);
  if (!employee) return { linked: false, employeeName: null, record: null };
  const date = todayDateOnly();
  const record = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });
  return { linked: true, employeeName: employee.name, record };
}

export async function markSelfAttendance(prisma: PrismaService, companyId: string, email: string, action: 'IN' | 'OUT') {
  const employee = await findLinkedEmployee(prisma, companyId, email);
  if (!employee) {
    throw new NotFoundException(
      'No employee record is linked to your account — ask an admin to set your employee email to match your login email.',
    );
  }

  const date = todayDateOnly();
  const time = nowTime();
  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });

  if (existing?.status === 'LEAVE') {
    throw new BadRequestException("You're marked on leave today — contact an admin if this is incorrect.");
  }

  if (action === 'IN') {
    if (existing?.checkInTime) throw new BadRequestException('You already checked in today');
    return prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: employee.id, date } },
      create: { companyId, employeeId: employee.id, date, status: 'PRESENT', checkInTime: time },
      update: { checkInTime: time, status: 'PRESENT' },
    });
  }

  if (!existing?.checkInTime) throw new BadRequestException('Please check in before checking out');
  if (existing.checkOutTime) throw new BadRequestException('You already checked out today');
  return prisma.attendance.update({ where: { id: existing.id }, data: { checkOutTime: time } });
}
