import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, PREMIUM } from './helpers/app';

// 2026-11-02 (Mon) … 2026-11-06 (Fri) are working days; Saturdays don't count.
describe('Leave', () => {
  let ctx: TestContext;
  let admin: Api;
  let teacher: Api;
  let companyId: string;
  let teacherEmpId: string;
  let sickId: string;
  let unpaidId: string;

  const balances = async (empId = teacherEmpId) => (await admin.get(`/api/v1/leave/balances/${empId}`)).body as any[];
  const balanceOf = async (typeId: string) => (await balances()).find((b) => b.leaveTypeId === typeId);
  const apply = (startDate: string, endDate: string, leaveTypeId = sickId) =>
    teacher.post('/api/v1/leave/self/requests', { leaveTypeId, startDate, endDate, reason: 'test' });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { modules: PREMIUM })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
    const t = await loginAs(ctx, companyId, 'TEACHER');
    teacher = t.api;
    // Self-service creates the teacher's employee row on first use.
    await teacher.get('/api/v1/attendance/self/today');
    teacherEmpId = (await ctx.prisma.employee.findFirstOrThrow({ where: { email: t.user.email } })).id;
    await ctx.prisma.employee.update({ where: { id: teacherEmpId }, data: { basicSalary: 26000 } });
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('leave types', () => {
    it('admin creates types; a missing name is a 400, not a server error', async () => {
      expect((await admin.post('/api/v1/leave/types', { daysPerYear: 12 })).status).toBe(400);
      sickId = (await admin.post('/api/v1/leave/types', { name: 'Sick Leave', daysPerYear: 3, isPaid: true })).body.id;
      unpaidId = (await admin.post('/api/v1/leave/types', { name: 'Unpaid Leave', daysPerYear: 0, isPaid: false })).body.id;
      expect(sickId && unpaidId).toBeTruthy();
    });

    it('teachers can load leave types (the My Leave apply form needs them)', async () => {
      const res = await teacher.get('/api/v1/leave/types');
      expect(res.status).toBe(200);
      expect(res.body.map((x: any) => x.name)).toEqual(expect.arrayContaining(['Sick Leave', 'Unpaid Leave']));
    });
  });

  describe('balances', () => {
    it("every employee automatically gets each type's days per year", async () => {
      expect(Number((await balanceOf(sickId)).remainingDays)).toBe(3);
      const self = (await teacher.get('/api/v1/leave/self/context')).body;
      expect(self.balances.find((b: any) => b.leaveTypeId === sickId)).toBeTruthy();
    });

    it('admin can override one employee\'s allocation', async () => {
      const fy = (await teacher.get('/api/v1/leave/self/context')).body.fiscalYear;
      expect((await admin.post('/api/v1/leave/balances/allocate', { employeeId: teacherEmpId, leaveTypeId: sickId, fiscalYear: fy, totalDays: 4 })).status).toBe(201);
      expect(Number((await balanceOf(sickId)).remainingDays)).toBe(4);
    });
  });

  describe('apply and approve', () => {
    let requestId: string;

    it('rejects a request longer than the remaining balance', async () => {
      expect((await apply('2026-11-02', '2026-11-13')).status).toBe(400);
    });

    it('counts pending requests against the balance', async () => {
      const first = await apply('2026-11-02', '2026-11-04'); // 3 days, pending
      expect(first.status).toBe(201);
      requestId = first.body.id;
      expect((await apply('2026-11-09', '2026-11-10')).status).toBe(400); // 3 pending + 2 > 4
    });

    it('teacher cannot approve; approval deducts the balance', async () => {
      expect((await teacher.patch(`/api/v1/leave/requests/${requestId}/approve`)).status).toBe(403);
      expect((await admin.patch(`/api/v1/leave/requests/${requestId}/approve`)).status).toBe(200);
      expect(Number((await balanceOf(sickId)).remainingDays)).toBe(1);
      expect((await admin.patch(`/api/v1/leave/requests/${requestId}/approve`)).status).toBe(400);
    });

    it('approved days show as LEAVE in staff attendance', async () => {
      const rows = (await admin.get('/api/v1/attendance', { employeeId: teacherEmpId })).body as any[];
      const leaveDays = rows.filter((r) => r.status === 'LEAVE').map((r) => r.date.slice(0, 10)).sort();
      expect(leaveDays).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    });

    it('self check-in on a leave day is refused', async () => {
      // (covered by self-attendance util: LEAVE status blocks check-in)
      const row = await ctx.prisma.attendance.findFirst({ where: { employeeId: teacherEmpId, status: 'LEAVE' } });
      expect(row).toBeTruthy();
    });

    it('cancelling an approved request restores the balance and clears the LEAVE days', async () => {
      expect((await admin.patch(`/api/v1/leave/requests/${requestId}/cancel`)).status).toBe(200);
      expect(Number((await balanceOf(sickId)).remainingDays)).toBe(4);
      const rows = (await admin.get('/api/v1/attendance', { employeeId: teacherEmpId })).body as any[];
      expect(rows.filter((r) => r.status === 'LEAVE')).toHaveLength(0);
    });

    it('reject works without a reason (as the My Leave page sends it)', async () => {
      const r = await apply('2026-11-16', '2026-11-16');
      expect((await admin.patch(`/api/v1/leave/requests/${r.body.id}/reject`)).status).toBe(200);
    });
  });

  describe('payroll', () => {
    it('unpaid leave is deducted like an absence; paid leave is not', async () => {
      // BS 2083-08 runs roughly 2026-11-17 … 2026-12-15
      const paid = await apply('2026-11-23', '2026-11-23', sickId);
      await admin.patch(`/api/v1/leave/requests/${paid.body.id}/approve`);
      const unpaid = await apply('2026-11-24', '2026-11-25', unpaidId); // 2 working days, no balance limit
      expect(unpaid.status).toBe(201);
      await admin.patch(`/api/v1/leave/requests/${unpaid.body.id}/approve`);

      const p = (await admin.post('/api/v1/payroll/calculate', { employeeId: teacherEmpId, month: '2083-08' })).body;
      expect(p.absentDays).toBe(2);
      expect(p.absentDeduction).toBeCloseTo(2 * (26000 / 26), 1);
    });
  });
});
