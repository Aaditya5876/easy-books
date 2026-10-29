import { createTestApp, resetDb, loginAs, Api, TestContext } from './helpers/app';
import { createSchool, School } from './helpers/school';

const S = '/api/v1/school';

// Forms must get a clear 4xx for bad input — never "Internal server error".
describe('Form validation across the school app', () => {
  let ctx: TestContext;
  let school: School;
  let admin: Api;
  let classId: string;
  let subjectId: string;
  let teacherEmpId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 2);
    admin = school.admin;
    classId = school.classId;
    subjectId = (await admin.post(`${S}/subjects`, { name: 'Maths', classIds: [classId] })).body.id;
    teacherEmpId = (await admin.post('/api/v1/employees', { name: 'Ram', employeeId: 'T-1' })).body.id;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('missing required fields → 400', () => {
    it.each([
      ['academic year without name', `${S}/academic-years`, { startDate: '2026-04-14', endDate: '2027-04-13' }],
      ['class without name', `${S}/classes`, { section: 'B' }],
      ['subject without name', `${S}/subjects`, { code: 'X' }],
      ['student without name', `${S}/students`, { classId: '__class__' }],
      ['student without class', `${S}/students`, { name: 'No Class' }],
      ['fee head without name', `${S}/fee-heads`, { code: 'X' }],
      ['fee structure without amount', `${S}/fee-structures`, { classId: '__class__', name: 'Tuition' }],
      ['transport route without name', `${S}/transport/routes`, { monthlyFee: 100 }],
      ['hostel room without number', `${S}/hostel/rooms`, { capacity: 2 }],
      ['exam schedule without date', `${S}/exam-schedules`, { classId: '__class__', examName: 'First Terminal' }],
      ['routine period without class', `${S}/timetable`, { dayOfWeek: 1, periodNumber: 1 }],
      ['study material without title', `${S}/study-materials`, { classId: '__class__', fileUrl: '/uploads/x.png' }],
      ['homework without title', `${S}/homework`, { classId: '__class__', dueDate: '2026-11-05' }],
      ['notice without title', `${S}/notices`, { content: 'x' }],
      ['event without title', `${S}/events`, { startDate: '2026-11-10' }],
      ['book without title', `${S}/library/books`, { totalCopies: 1 }],
      ['user invite without email', '/api/v1/users/invite', { name: 'X', role: 'STAFF' }],
    ])('%s', async (_label, url, body) => {
      const payload = JSON.parse(JSON.stringify(body).replace(/__class__/g, classId));
      const res = await admin.post(url, payload);
      expect(res.status).toBe(400);
      expect(String(res.body.message)).not.toMatch(/internal server error/i);
    });
  });

  describe('bad values → 4xx', () => {
    it('unknown event type is a 400', async () => {
      expect((await admin.post(`${S}/events`, { title: 'X', startDate: '2026-11-10', eventType: 'PARTY' })).status).toBe(400);
    });

    it('event ending before it starts is a 400', async () => {
      expect((await admin.post(`${S}/events`, { title: 'X', startDate: '2026-11-10', endDate: '2026-11-01', eventType: 'GENERAL' })).status).toBe(400);
    });

    it('duplicate hostel room number is a 409 with a clear message', async () => {
      await admin.post(`${S}/hostel/rooms`, { roomNumber: '101', capacity: 2, monthlyFee: 0 });
      const res = await admin.post(`${S}/hostel/rooms`, { roomNumber: '101', capacity: 2, monthlyFee: 0 });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('unknown record id is a 404', async () => {
      expect((await admin.put(`${S}/classes/00000000-0000-0000-0000-000000000000`, { name: 'X' })).status).toBe(404);
    });
  });

  describe('exam marks', () => {
    let examId: string;
    beforeAll(async () => {
      examId = (await admin.post(`${S}/exams`, { name: 'First Terminal', examDate: '2026-11-20' })).body.id;
    });
    const bulk = (marks: number) => admin.post(`${S}/exam-results/bulk`, {
      examId, subjectId, totalMarks: 100, entries: [{ studentId: school.students[0].id, marksObtained: marks }],
    });

    it('accepts valid marks', async () => { expect((await bulk(88)).status).toBe(201); });
    it('rejects marks above the total', async () => { expect((await bulk(150)).status).toBe(400); });
    it('rejects negative marks', async () => { expect((await bulk(-5)).status).toBe(400); });
    it('single result form rejects marks above the total', async () => {
      const res = await admin.post(`${S}/exam-results`, { studentId: school.students[1].id, subjectId, examName: 'First Terminal', marksObtained: 120, totalMarks: 100 });
      expect(res.status).toBe(400);
    });
  });

  describe('routine', () => {
    it('a teacher cannot be booked into two classes in the same period', async () => {
      const class6 = (await admin.post(`${S}/classes`, { name: 'Class 6' })).body.id;
      const slot = { subjectId, teacherId: teacherEmpId, dayOfWeek: 1, periodNumber: 1, startTime: '10:00', endTime: '10:45' };
      expect((await admin.post(`${S}/timetable`, { classId, ...slot })).status).toBe(201);
      expect((await admin.post(`${S}/timetable`, { classId: class6, ...slot })).status).toBe(409);
      // re-saving the same class's own slot is still fine
      expect((await admin.post(`${S}/timetable`, { classId, ...slot, roomNumber: '5A' })).status).toBe(201);
    });
  });

  describe('events by role', () => {
    it('staff can add calendar events; teachers cannot', async () => {
      const staff = (await loginAs(ctx, school.companyId, 'STAFF')).api;
      const teacher = (await loginAs(ctx, school.companyId, 'TEACHER')).api;
      expect((await staff.post(`${S}/events`, { title: 'PTA', startDate: '2026-11-12', eventType: 'MEETING' })).status).toBe(201);
      expect((await teacher.post(`${S}/events`, { title: 'X', startDate: '2026-11-12', eventType: 'GENERAL' })).status).toBe(403);
    });
  });
});
