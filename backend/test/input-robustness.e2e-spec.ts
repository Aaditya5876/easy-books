import { createTestApp, resetDb, createCompany, loginAs, Api, TestContext, PREMIUM } from './helpers/app';

// Every form posts to one of these. Whatever a user (or a bad network) sends,
// the answer must be a clear 4xx message — never a 500 "Internal server error",
// which the screens can only show as "Something went wrong".
const BUSINESS_ROUTES = [
  'attendance', 'bank-accounts', 'bank-guarantees', 'cheques', 'clients', 'credit-notes', 'debit-notes',
  'employees', 'fixed-assets', 'inventory', 'leave/requests', 'leave/types', 'ledger/accounts', 'ledger/entries',
  'memos', 'petty-cash', 'purchases', 'quotations', 'sales', 'spaces', 'tasks', 'transactions', 'vendors',
  'users/invite',
];
const SCHOOL_ROUTES = [
  'school/academic-years', 'school/attendance', 'school/classes', 'school/events', 'school/exam-results',
  'school/exam-schedules', 'school/exams', 'school/fee-heads', 'school/fee-invoices', 'school/fee-packages',
  'school/fee-structures', 'school/homework', 'school/hostel/allocations', 'school/hostel/rooms',
  'school/library/books', 'school/library/issues', 'school/notices', 'school/students', 'school/study-materials',
  'school/subjects', 'school/timetable', 'school/transport/assignments', 'school/transport/routes',
];

// Shapes a careless form or user can produce: nothing, wrong types, blanks.
const BAD_BODIES: Record<string, object> = {
  empty: {},
  wrongTypes: {
    name: 123, title: ['x'], description: { a: 1 }, amount: 'abc', quantity: 'many', unitPrice: -5, totalAmount: 'x',
    dateAd: 'not-a-date', date: 'yesterday', dueDate: '2026-13-45', email: 'not-an-email', phone: 99, items: 'nope',
    classId: 'not-a-uuid', studentId: 12, employeeId: true, accountType: 'MAGIC', status: 'WHATEVER', isVat: 'yes',
  },
  blanksAndBadLines: {
    name: '', title: '   ', amount: 0, quantity: -1, dateAd: '', email: '', items: [{}, { description: '', quantity: 'x' }],
    payment: { type: 'FULL' }, openingBalance: -100,
  },
};

describe('Input robustness: no form input can crash the server (500)', () => {
  let ctx: TestContext;
  let business: Api;
  let school: Api;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const biz = (await createCompany(ctx.prisma, { name: 'Robust Biz', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    const sch = (await createCompany(ctx.prisma, { name: 'Robust School', businessType: 'SCHOOL', modules: PREMIUM })).id;
    business = (await loginAs(ctx, biz, 'ADMIN')).api;
    school = (await loginAs(ctx, sch, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('every create endpoint answers bad input with a 4xx and a message', async () => {
    const crashes: string[] = [];
    const vague: string[] = [];
    for (const [api, routes] of [[business, BUSINESS_ROUTES], [school, SCHOOL_ROUTES]] as const) {
      for (const route of routes) {
        for (const [kind, body] of Object.entries(BAD_BODIES)) {
          const res = await api.post(`/api/v1/${route}`, body);
          if (res.status >= 500) crashes.push(`${route} [${kind}] → ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`);
          else if (res.status >= 400 && !res.body?.message) vague.push(`${route} [${kind}] → ${res.status} with no message`);
        }
      }
    }
    // Printed so a failure lists every offender at once.
    if (crashes.length || vague.length) console.log([...crashes, ...vague].join('\n'));
    expect(crashes).toEqual([]);
    expect(vague).toEqual([]);
  });
});
