import { createTestApp, resetDb, loginAs, Api, TestContext, nepalToday } from './helpers/app';
import { createSchool, billAndRelease, School } from './helpers/school';

const S = '/api/v1/school';

// The GET calls each page makes when it opens.
const PAGES: Record<string, [string, Record<string, string>?][]> = {
  Dashboard: [[`${S}/dashboard`]],
  'My Attendance': [['/api/v1/attendance/self/today']],
  'My Leave': [['/api/v1/leave/self/context'], ['/api/v1/leave/self/requests'], ['/api/v1/leave/types']],
  'Reports (attendance/academics)': [[`${S}/analytics/attendance`], [`${S}/analytics/academics`]],
  'Reports (fees/operations)': [[`${S}/analytics/fees`], [`${S}/analytics/operations`]],
  'Calendar and Events': [[`${S}/events`], [`${S}/exam-schedules`]],
  Employees: [['/api/v1/employees']],
  Classes: [[`${S}/classes`]],
  Subjects: [[`${S}/subjects`]],
  Students: [[`${S}/students`]],
  Attendance: [[`${S}/attendance/summary`]],
  Routine: [[`${S}/timetable`]],
  Exam: [[`${S}/exams`], [`${S}/exam-results`], [`${S}/exam-schedules`]],
  'Study Material': [[`${S}/study-materials`]],
  Homework: [[`${S}/homework`]],
  Fees: [[`${S}/fee-invoices`], [`${S}/fee-structures`], [`${S}/fee-heads`], [`${S}/fee-packages`]],
  'Fees: Pending Proofs': [[`${S}/fee-payments/pending`]],
  Ledger: [['/api/v1/ledger/accounts'], ['/api/v1/ledger/entries']],
  Transactions: [['/api/v1/transactions']],
  Notices: [[`${S}/notices`]],
  Library: [[`${S}/library/books`], [`${S}/library/issues`]],
  Hostel: [[`${S}/hostel/rooms`], [`${S}/hostel/allocations`]],
  Transport: [[`${S}/transport/routes`], [`${S}/transport/assignments`]],
  'Staff Attendance': [['/api/v1/attendance']],
  Payroll: [['/api/v1/payroll/summary', { month: '2083-07' }]],
  'Settings (admin)': [['/api/v1/users'], ['/api/v1/audit-logs']],
};
const ALL = Object.keys(PAGES);
const STAFF_PAGES = ['Dashboard', 'My Attendance', 'My Leave', 'Reports (attendance/academics)', 'Reports (fees/operations)', 'Calendar and Events',
  'Classes', 'Subjects', 'Students', 'Attendance', 'Routine', 'Exam', 'Study Material', 'Homework', 'Fees', 'Notices'];

const ROLES: [string, 'ACCOUNTANT' | 'TEACHER' | 'STAFF', string[], string[]][] = [
  ['ACCOUNTANT', 'ACCOUNTANT', [], ALL.filter((p) => p !== 'Settings (admin)')],
  ['TEACHER', 'TEACHER', [], ['Dashboard', 'My Attendance', 'My Leave', 'Reports (attendance/academics)', 'Calendar and Events', 'Classes', 'Subjects', 'Students', 'Attendance', 'Routine', 'Exam', 'Study Material', 'Homework', 'Notices']],
  ['STAFF', 'STAFF', [], STAFF_PAGES],
  ['STAFF + HR', 'STAFF', ['HR'], [...STAFF_PAGES, 'Employees', 'Staff Attendance']],
  ['STAFF + LIBRARY', 'STAFF', ['LIBRARY'], [...STAFF_PAGES, 'Library']],
  ['STAFF + HOSTEL', 'STAFF', ['HOSTEL'], [...STAFF_PAGES, 'Hostel']],
  ['STAFF + TRANSPORT', 'STAFF', ['TRANSPORT'], [...STAFF_PAGES, 'Transport']],
  ['STAFF + FRONT_OFFICE', 'STAFF', ['FRONT_OFFICE'], STAFF_PAGES],
];

describe('Role access', () => {
  let ctx: TestContext;
  let school: School;
  let invoices: Record<string, any>;
  let subjectId: string;
  let examId: string;
  let routeId: string;
  let bookId: string;
  let driverId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 3);
    invoices = await billAndRelease(school);
    const a = school.admin;
    subjectId = (await a.post(`${S}/subjects`, { name: 'Maths', classIds: [school.classId] })).body.id;
    examId = (await a.post(`${S}/exams`, { name: 'First Terminal' })).body.id;
    routeId = (await a.post(`${S}/transport/routes`, { routeName: 'Route A', monthlyFee: 1000 })).body.id;
    bookId = (await a.post(`${S}/library/books`, { title: 'Book', totalCopies: 5, availableCopies: 5 })).body.id;
    driverId = (await a.post('/api/v1/employees', { name: 'Driver', employeeId: 'D-1' })).body.id;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe.each(ROLES)('%s: sidebar pages open, everything else is refused', (_label, role, tags, visible) => {
    let api: Api;
    beforeAll(async () => { api = (await loginAs(ctx, school.companyId, role, tags)).api; });
    it.each(ALL)('%s', async (page) => {
      const shown = visible.includes(page);
      for (const [url, q] of PAGES[page]) {
        const status = (await api.get(url, q)).status;
        expect([page, url, shown ? (status < 300 ? 'ok' : status) : status]).toEqual([page, url, shown ? 'ok' : 403]);
      }
    });
  });

  describe('forms each role uses', () => {
    it('TEACHER: register, homework, marks, routine; not enrolment, payments, notices or events', async () => {
      const t = (await loginAs(ctx, school.companyId, 'TEACHER')).api;
      const st = school.students;
      expect((await t.post(`${S}/attendance`, { classId: school.classId, date: nepalToday(), entries: [{ studentId: st[0].id, status: 'PRESENT' }] })).status).toBe(201);
      expect((await t.post(`${S}/homework`, { classId: school.classId, subjectId, title: 'HW', dueDate: '2026-11-06' })).status).toBe(201);
      expect((await t.post(`${S}/exam-results/bulk`, { examId, subjectId, totalMarks: 100, entries: [{ studentId: st[1].id, marksObtained: 60 }] })).status).toBe(201);
      expect((await t.post(`${S}/timetable`, { classId: school.classId, subjectId, dayOfWeek: 2, periodNumber: 2, startTime: '11:00', endTime: '11:45' })).status).toBe(201);
      expect((await t.post(`${S}/students`, { name: 'X', classId: school.classId })).status).toBe(403);
      expect((await t.patch(`${S}/fee-invoices/${invoices[st[1].id].id}/payment`, { amount: 10, method: 'CASH' })).status).toBe(403);
      expect((await t.post(`${S}/notices`, { title: 'X', content: 'Y' })).status).toBe(403);
      expect((await t.post('/api/v1/ai/homework-description', { subject: 'Maths', topic: 'Fractions', className: 'Class 5', dueDate: '2026-11-06' })).status).toBe(201);
    });

    it('STAFF: enrols and takes desk payments; cannot bill, verify proofs, give portal access or see employees', async () => {
      const s = (await loginAs(ctx, school.companyId, 'STAFF')).api;
      const st = school.students;
      expect((await s.post(`${S}/students`, { name: 'Staff Enrolled', classId: school.classId })).status).toBe(201);
      expect((await s.patch(`${S}/fee-invoices/${invoices[st[1].id].id}/payment`, { amount: 100, method: 'CASH' })).status).toBe(200);
      expect((await s.post(`${S}/billing-run`)).status).toBe(403);
      expect((await s.get(`${S}/fee-payments/pending`)).status).toBe(403);
      expect((await s.raw().post('/api/v1/portal/set-password').send({ companyId: school.companyId, studentId: st[1].id, phone: st[1].phone, password: 'Kid@1234' })).status).toBe(403);
    });

    it('FRONT_OFFICE: gives portal access (single and whole class)', async () => {
      const fo = (await loginAs(ctx, school.companyId, 'STAFF', ['FRONT_OFFICE'])).api;
      const st = school.students[1];
      expect((await fo.raw().post('/api/v1/portal/set-password').send({ companyId: school.companyId, studentId: st.id, phone: st.phone, password: 'Kid@1234' })).status).toBe(201);
      expect((await fo.raw().post('/api/v1/portal/bulk-set-access').send({ companyId: school.companyId, classId: school.classId })).status).toBe(201);
    });

    it('HR: adds and imports employees, marks staff attendance; cannot run payroll or delete employees', async () => {
      const hr = (await loginAs(ctx, school.companyId, 'STAFF', ['HR'])).api;
      expect((await hr.post('/api/v1/employees', { name: 'HR Added', employeeId: 'HR-1' })).status).toBe(201);
      expect((await hr.post('/api/v1/bulk/employees', { rows: [{ name: 'HR Import', employeeId: 'HR-2' }] })).status).toBe(201);
      expect((await hr.post('/api/v1/attendance', { employeeId: driverId, date: '2026-10-29', status: 'PRESENT' })).status).toBe(201);
      expect((await hr.post('/api/v1/payroll/process', { month: '2083-07' })).status).toBe(403);
      expect((await hr.del(`/api/v1/employees/${driverId}`)).status).toBe(403);
    });

    it('LIBRARY / HOSTEL / TRANSPORT staff manage only their own facility', async () => {
      const lib = (await loginAs(ctx, school.companyId, 'STAFF', ['LIBRARY'])).api;
      expect((await lib.post(`${S}/library/issues`, { bookId, studentId: school.students[2].id, dueDate: '2026-11-20' })).status).toBe(201);
      expect((await lib.get(`${S}/hostel/rooms`)).status).toBe(403);
      const hostel = (await loginAs(ctx, school.companyId, 'STAFF', ['HOSTEL'])).api;
      expect((await hostel.post(`${S}/hostel/rooms`, { roomNumber: '202', capacity: 3, monthlyFee: 4000 })).status).toBe(201);
      expect((await hostel.get(`${S}/library/books`)).status).toBe(403);
      const transport = (await loginAs(ctx, school.companyId, 'STAFF', ['TRANSPORT'])).api;
      expect((await transport.post(`${S}/transport/assignments`, { routeId, studentId: school.students[1].id, pickupStop: 'Gate' })).status).toBe(201);
    });

    it('ACCOUNTANT: billing, proofs, transactions, fiscal year; cannot invite users', async () => {
      const ac = (await loginAs(ctx, school.companyId, 'ACCOUNTANT')).api;
      expect((await ac.post(`${S}/billing-run`)).status).toBe(201);
      expect((await ac.get(`${S}/fee-payments/pending`)).status).toBe(200);
      expect((await ac.post('/api/v1/transactions', { dateAd: nepalToday(), type: 'CASH', category: 'EXPENSE', amount: 100, description: 'Chalk' })).status).toBe(201);
      expect((await ac.get('/api/v1/fiscal-year/status')).status).toBe(200);
      expect((await ac.post('/api/v1/users/invite', { email: 'y@test.local', name: 'Y', role: 'STAFF' })).status).toBe(403);
    });
  });
});
