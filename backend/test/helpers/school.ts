import { Api, TestContext, createCompany, loginAs, PREMIUM } from './app';

const S = '/api/v1/school';

export interface School {
  companyId: string;
  admin: Api;
  classId: string;
  students: { id: string; name: string; phone: string }[];
}

// A Premium school with one class and `count` students, created through the
// same API calls the admin's forms make.
export async function createSchool(ctx: TestContext, count = 3, modules = PREMIUM): Promise<School> {
  const companyId = (await createCompany(ctx.prisma, { modules })).id;
  const admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  const classId = (await admin.post(`${S}/classes`, { name: 'Class 5', section: 'A' })).body.id;
  const students = [];
  for (let i = 0; i < count; i++) {
    const phone = `98${String(companyId.replace(/\D/g, '')).slice(0, 4).padEnd(4, '0')}${String(i).padStart(4, '0')}`;
    const name = `Student ${i + 1}`;
    const res = await admin.post(`${S}/students`, { name, classId, rollNumber: String(i + 1), guardianName: `Parent ${i + 1}`, guardianPhone: phone });
    students.push({ id: res.body.id, name, phone });
  }
  return { companyId, admin, classId, students };
}

// Tuition 3000/month for the class, billed and released for every student.
export async function billAndRelease(school: School, amount = 3000) {
  const { admin, classId } = school;
  await admin.post(`${S}/fee-heads/defaults`);
  const heads = (await admin.get(`${S}/fee-heads`)).body as any[];
  const tuition = heads.find((h) => h.code === 'TUI').id;
  await admin.post(`${S}/fee-structures`, { classId, feeHeadId: tuition, name: 'Tuition', amount, frequency: 'MONTHLY' });
  await admin.post(`${S}/billing-run`, {});
  await admin.post(`${S}/fee-invoices/release-bulk`, {});
  const invoices = (await admin.get(`${S}/fee-invoices`, { pageSize: 100 })).body;
  const list = (Array.isArray(invoices) ? invoices : invoices.data) as any[];
  return Object.fromEntries(school.students.map((s) => [s.id, list.find((i) => i.studentId === s.id)]));
}

// Gives a student portal access and returns a logged-in portal client
// (past the forced first-login password change).
export async function portalLogin(ctx: TestContext, school: School, student: { id: string; phone: string }) {
  await school.admin.raw().post('/api/v1/portal/set-password')
    .send({ companyId: school.companyId, studentId: student.id, phone: student.phone, password: 'Kid@1234' });
  // The session rides in an HttpOnly cookie, which the agent keeps like a browser.
  const portal = new Api(ctx.app);
  await portal.agent.post('/api/v1/portal/login').send({ phone: student.phone, password: 'Kid@1234' });
  await portal.patch('/api/v1/portal/change-password', { currentPassword: 'Kid@1234', newPassword: 'Kid@12345' });
  await portal.agent.post('/api/v1/portal/login').send({ phone: student.phone, password: 'Kid@12345' });
  return portal;
}

// The raw portal token from a login/change-password response's Set-Cookie —
// for tests that simulate a copied (stolen) session.
export function portalCookieToken(res: { headers: Record<string, any> }) {
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('portalToken='));
  return cookie ? decodeURIComponent(cookie.split(';')[0].slice('portalToken='.length)) : undefined;
}

export const ledgerTotals = async (admin: Api) => {
  const entries = (await admin.get('/api/v1/ledger/entries')).body as any[];
  return {
    count: entries.length,
    debit: entries.reduce((s, e) => s + Number(e.debit), 0),
    credit: entries.reduce((s, e) => s + Number(e.credit), 0),
  };
};
