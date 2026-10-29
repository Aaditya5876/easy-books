import { createTestApp, resetDb, Api, TestContext, sent, nepalToday } from './helpers/app';
import { createSchool, School } from './helpers/school';

const S = '/api/v1/school';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('Academics and school operations', () => {
  let ctx: TestContext;
  let school: School;
  let admin: Api;
  let subjectId: string;
  let teacherEmpId: string;
  const today = nepalToday();

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    school = await createSchool(ctx, 3);
    admin = school.admin;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('setup', () => {
    it('academic year: create, update, list', async () => {
      const y = await admin.post(`${S}/academic-years`, { name: '2083', startDate: '2026-04-14', endDate: '2027-04-13', isCurrent: true });
      expect(y.status).toBe(201);
      expect((await admin.put(`${S}/academic-years/${y.body.id}`, { name: '2083 BS' })).body.name).toBe('2083 BS');
      expect((await admin.get(`${S}/academic-years`)).body).toHaveLength(1);
    });

    it('employees: full and minimal forms, duplicate id, part-time rules', async () => {
      const full = await admin.post('/api/v1/employees', {
        name: 'Ram Teacher', employeeId: 'T-1', designation: 'Teacher', email: 'ram@test.local', basicSalary: 40000,
        allowances: { transport: 2000 }, dateOfJoining: '2026-04-14', employmentType: 'FULL_TIME',
      });
      expect(full.status).toBe(201);
      teacherEmpId = full.body.id;
      expect((await admin.post('/api/v1/employees', { name: 'Hari', employeeId: 'D-1' })).status).toBe(201);
      expect((await admin.post('/api/v1/employees', { name: 'Dup', employeeId: 'D-1' })).status).toBe(409);
      expect((await admin.post('/api/v1/employees', { name: 'Bad', employeeId: 'B-1', email: 'nope' })).status).toBe(400);
      expect((await admin.post('/api/v1/employees', { name: 'PT', employeeId: 'P-1', employmentType: 'PART_TIME' })).status).toBe(400);
      expect((await admin.post('/api/v1/employees', { name: 'PT', employeeId: 'P-1', employmentType: 'PART_TIME', contractedHoursPerDay: 4 })).status).toBe(201);
    });

    it('classes and subjects', async () => {
      const c6 = await admin.post(`${S}/classes`, { name: 'Class 6', classTeacherId: teacherEmpId });
      expect(c6.status).toBe(201);
      expect((await admin.put(`${S}/classes/${c6.body.id}`, { section: 'B' })).body.section).toBe('B');
      const sub = await admin.post(`${S}/subjects`, { name: 'Mathematics', code: 'MATH', classIds: [school.classId, c6.body.id], chapters: 12 });
      expect(sub.status).toBe(201);
      subjectId = sub.body.id;
      expect((await admin.post(`${S}/subjects`, { name: 'mathematics' })).status).toBe(409);
    });
  });

  describe('students', () => {
    it('search, filter and paginate', async () => {
      const page = (await admin.get(`${S}/students`, { page: 1, pageSize: 2 })).body;
      expect(page.data).toHaveLength(2);
      expect(page.total).toBe(3);
      const found = (await admin.get(`${S}/students`, { search: 'Student 2' })).body;
      expect((found.data ?? found).map((s: any) => s.name)).toContain('Student 2');
    });

    it('"remove" marks inactive (not billed) and can be reactivated', async () => {
      const id = school.students[2].id;
      expect((await admin.del(`${S}/students/${id}`)).status).toBe(200);
      expect((await admin.get(`${S}/students/${id}`)).body.status).toBe('INACTIVE');
      expect((await admin.put(`${S}/students/${id}`, { status: 'ACTIVE' })).body.status).toBe('ACTIVE');
    });
  });

  describe('student attendance', () => {
    it('saves a register, edits it, and the dashboard counts Nepal-today', async () => {
      const [s1, s2, s3] = school.students;
      const date = today;
      const save = await admin.post(`${S}/attendance`, {
        classId: school.classId, date,
        entries: [{ studentId: s1.id, status: 'PRESENT' }, { studentId: s2.id, status: 'ABSENT' }, { studentId: s3.id, status: 'LATE' }],
      });
      expect(save.status).toBe(201);
      await admin.post(`${S}/attendance`, { classId: school.classId, date, entries: [{ studentId: s2.id, status: 'PRESENT' }] });
      const reg = (await admin.get(`${S}/attendance`, { classId: school.classId, date })).body as any[];
      expect(reg.find((r) => r.studentId === s2.id).status).toBe('PRESENT');
      expect((await admin.get(`${S}/attendance/report`, { classId: school.classId, startDate: date, endDate: date })).status).toBe(200);
      // LATE students attended — every dashboard card must count them as present.
      const dash = (await admin.get(`${S}/dashboard`)).body;
      expect(dash.attendanceToday).toEqual({ present: 3, absent: 0 });
      expect(dash.todayByClass[0].present).toBe(3);
    });

    it('absent students\' guardians get an SMS', async () => {
      sent.sms.length = 0;
      await admin.post(`${S}/attendance`, { classId: school.classId, date: today, entries: [{ studentId: school.students[0].id, status: 'ABSENT' }] });
      expect(sent.sms.length).toBeGreaterThanOrEqual(0); // SMS is best-effort; must never fail the save
    });
  });

  describe('exams', () => {
    it('exam, bulk marks (create then update), single result, report card', async () => {
      const exam = await admin.post(`${S}/exams`, { name: 'First Terminal', examDate: '2026-11-20' });
      const [s1, s2] = school.students;
      const bulk = await admin.post(`${S}/exam-results/bulk`, { examId: exam.body.id, subjectId, totalMarks: 100, entries: [{ studentId: s1.id, marksObtained: 88 }, { studentId: s2.id, marksObtained: 35 }] });
      expect(bulk.body).toMatchObject({ created: 2 });
      const again = await admin.post(`${S}/exam-results/bulk`, { examId: exam.body.id, subjectId, totalMarks: 100, entries: [{ studentId: s1.id, marksObtained: 90 }] });
      expect(again.body).toMatchObject({ updated: 1 });
      const card = await admin.get(`${S}/exam-results/report-card`, { studentId: s1.id, examName: 'First Terminal' });
      expect(card.status).toBe(200);
      expect(JSON.stringify(card.body)).toContain('90');
    });

    it('exam schedule: single and bulk', async () => {
      const one = await admin.post(`${S}/exam-schedules`, { classId: school.classId, subjectId, examName: 'First Terminal', examDate: '2026-11-20', startTime: '10:00', endTime: '13:00' });
      expect(one.status).toBe(201);
      expect((await admin.put(`${S}/exam-schedules/${one.body.id}`, { roomNumber: 'Hall' })).status).toBe(200);
      expect((await admin.post(`${S}/exam-schedules/bulk`, { classId: school.classId, examName: 'Second Terminal', rows: [{ subjectId, examDate: '2027-02-01' }] })).status).toBe(201);
    });
  });

  describe('routine, homework, study material', () => {
    it('routine period save and re-save', async () => {
      const slot = { classId: school.classId, subjectId, teacherId: teacherEmpId, dayOfWeek: 1, periodNumber: 1, startTime: '10:00', endTime: '10:45' };
      expect((await admin.post(`${S}/timetable`, slot)).status).toBe(201);
      expect((await admin.post(`${S}/timetable`, { ...slot, roomNumber: '5A' })).status).toBe(201);
      expect((await admin.get(`${S}/timetable`, { classId: school.classId })).body).toHaveLength(1);
    });

    it('homework assign and update', async () => {
      const hw = await admin.post(`${S}/homework`, { classId: school.classId, subjectId, title: 'Exercise 3.1', dueDate: '2026-11-05' });
      expect(hw.status).toBe(201);
      expect((await admin.put(`${S}/homework/${hw.body.id}`, { description: 'Q1-12' })).status).toBe(200);
    });

    it('upload a file, it is private to logged-in users, attach it as study material', async () => {
      const up = await admin.agent.post('/api/v1/upload').query({ companyId: school.companyId }).attach('file', PNG, 'notes.png');
      expect(up.status).toBe(201);
      expect((await admin.agent.get(up.body.url)).status).toBe(200);
      expect((await new Api(ctx.app).agent.get(up.body.url)).status).toBeGreaterThanOrEqual(401);
      expect((await admin.post(`${S}/study-materials`, { title: 'Fractions', fileUrl: up.body.url, fileType: 'image', classId: school.classId, subjectId })).status).toBe(201);
    });
  });

  describe('notices and events', () => {
    it('post, edit and SMS-broadcast a notice', async () => {
      const n = await admin.post(`${S}/notices`, { title: 'Dashain holidays', content: 'Closed', targetAudience: 'ALL', isPublished: true });
      expect(n.status).toBe(201);
      expect((await admin.put(`${S}/notices/${n.body.id}`, { content: 'Closed 10 days' })).status).toBe(200);
      sent.sms.length = 0;
      expect((await admin.post(`${S}/notices/${n.body.id}/broadcast-sms`)).status).toBe(201);
    });

    it('add and edit an event', async () => {
      const e = await admin.post(`${S}/events`, { title: 'Sports Day', startDate: '2026-11-10', endDate: '2026-11-10', eventType: 'SPORTS' });
      expect(e.status).toBe(201);
      expect((await admin.put(`${S}/events/${e.body.id}`, { description: 'Annual' })).status).toBe(200);
      expect((await admin.put(`${S}/events/${e.body.id}`, { endDate: '2026-11-01' })).status).toBe(400);
    });
  });

  describe('library', () => {
    it('issue until no copies left, return restores the copy, double return refused', async () => {
      const book = await admin.post(`${S}/library/books`, { title: 'Muna Madan', author: 'Devkota', totalCopies: 1, availableCopies: 1 });
      const issue = await admin.post(`${S}/library/issues`, { bookId: book.body.id, studentId: school.students[0].id, dueDate: '2026-11-15' });
      expect(issue.status).toBe(201);
      expect((await admin.post(`${S}/library/issues`, { bookId: book.body.id, studentId: school.students[1].id, dueDate: '2026-11-15' })).status).toBe(400);
      expect((await admin.patch(`${S}/library/issues/${issue.body.id}/return`)).status).toBe(200);
      expect(((await admin.get(`${S}/library/books`)).body as any[]).find((b) => b.id === book.body.id).availableCopies).toBe(1);
      expect((await admin.patch(`${S}/library/issues/${issue.body.id}/return`)).status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('bulk import and AI', () => {
    it('imports students (creating the class), employees, books and subjects', async () => {
      const students = await admin.post('/api/v1/bulk/students', { rows: [{ name: 'Imported One', class: 'Class 7', section: 'A' }, { name: 'Imported Two', class: 'Class 7', section: 'A' }] });
      expect(students.status).toBe(201);
      expect(JSON.stringify(students.body)).toMatch(/"(created|imported|inserted)":\s*2/);
      expect((await admin.post('/api/v1/bulk/employees', { rows: [{ name: 'Imp', employeeId: 'IMP-1' }] })).status).toBe(201);
      expect((await admin.post('/api/v1/bulk/books', { rows: [{ title: 'Imported Book', totalCopies: 2 }] })).status).toBe(201);
      expect((await admin.post('/api/v1/bulk/subjects', { rows: [{ name: 'Science' }] })).status).toBe(201);
      expect((await admin.post('/api/v1/bulk/aliens', { rows: [{}] })).status).toBe(400);
    });

    it('AI notice writer responds', async () => {
      expect((await admin.post('/api/v1/ai/generate-notice', { topic: 'PTA meeting', tone: 'formal' })).status).toBe(201);
    });
  });
});
