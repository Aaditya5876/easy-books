import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request = require('supertest');
import { AppModule } from '../../src/modules/app.module';
import { PrismaService } from '../../core/db/psql/prisma.client';
import { MailService } from '../../src/application/services/mail.service';
import { SmsService } from '../../src/application/services/sms.service';
import { AiService } from '../../src/application/services/ai.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

export const PASSWORD = 'Test@123';

// Outbound side effects are stubbed: tests never email, text or call Gemini.
export const sent = { mail: [] as unknown[][], sms: [] as unknown[][] };
const mailStub = {
  sendOtpVerification: async (...a: unknown[]) => { sent.mail.push(a); },
  sendInvitation: async (...a: unknown[]) => { sent.mail.push(a); return true; },
  sendPasswordReset: async (...a: unknown[]) => { sent.mail.push(a); return true; },
};
const smsStub = {
  send: async (...a: unknown[]) => { sent.sms.push(a); return true; },
  sendAbsentAlert: async (...a: unknown[]) => { sent.sms.push(a); return true; },
  sendFeeReminder: async (...a: unknown[]) => { sent.sms.push(a); return true; },
  sendPortalCredentials: async (...a: unknown[]) => { sent.sms.push(a); return true; },
  sendNotice: async (phones: string[]) => { sent.sms.push([phones]); return { sent: phones.length, failed: 0 }; },
};
const aiStub = {
  generateNotice: async () => ({ title: 'AI notice', content: 'AI generated content' }),
  generateReportComment: async () => ({ comment: 'Good progress' }),
  getClassInsights: async () => ({ insights: [] }),
  generateFeeReminder: async () => ({ message: 'Please pay' }),
  generateHomeworkDescription: async () => ({ description: 'Do the exercise' }),
};

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService).useValue(mailStub)
    .overrideProvider(SmsService).useValue(smsStub)
    .overrideProvider(AiService).useValue(aiStub)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.use(cookieParser());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDb(prisma: PrismaService) {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  sent.mail.length = 0;
  sent.sms.length = 0;
}

export const PREMIUM = [
  'BASE', 'SCHOOL_ACADEMICS', 'SCHOOL_ACADEMICS_ROUTINE', 'SCHOOL_ACADEMICS_EXAMS', 'SCHOOL_ACADEMICS_STUDY_MATERIALS',
  'SCHOOL_ACADEMICS_HOMEWORK', 'FACILITIES', 'FACILITIES_LIBRARY', 'FACILITIES_HOSTEL', 'FACILITIES_TRANSPORT', 'HRMS',
  'HRMS_EMPLOYEES', 'HRMS_ATTENDANCE', 'HRMS_LEAVE', 'HRMS_PAYROLL', 'AI', 'AI_NOTICES', 'AI_INSIGHTS', 'AI_REPORT_CARDS',
  'BULK_IMPORT', 'BULK_IMPORT_STUDENTS', 'BULK_IMPORT_EMPLOYEES', 'BULK_IMPORT_ITEMS', 'FINANCE_FEES', 'FINANCE_TRANSACTIONS',
  'FINANCE_LEDGER', 'INVENTORY', 'INVENTORY_STOCK',
];
export const STANDARD = ['BASE', 'SCHOOL_ACADEMICS', 'SCHOOL_ACADEMICS_ROUTINE', 'SCHOOL_ACADEMICS_EXAMS', 'SCHOOL_ACADEMICS_STUDY_MATERIALS', 'SCHOOL_ACADEMICS_HOMEWORK'];
export const BASE = ['BASE'];

export async function createCompany(prisma: PrismaService, opts: { name?: string; businessType?: string; modules?: string[] } = {}) {
  return prisma.company.create({
    data: { name: opts.name ?? 'Test School', businessType: opts.businessType ?? 'SCHOOL', enabledModules: opts.modules ?? PREMIUM },
  });
}

let hashed: string | undefined;
export async function createUser(
  prisma: PrismaService,
  companyId: string,
  role: 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'TEACHER' | 'SUPER_ADMIN',
  opts: { email?: string; tags?: string[]; name?: string } = {},
) {
  hashed ??= await bcrypt.hash(PASSWORD, 4);
  const tagPart = opts.tags?.length ? `-${opts.tags.join('-').toLowerCase()}` : '';
  const email = opts.email ?? `${role.toLowerCase()}${tagPart}-${companyId.slice(0, 6)}@test.local`;
  return prisma.user.create({
    data: {
      email, name: opts.name ?? `${role} user`, password: hashed, role, staffTags: opts.tags ?? [],
      emailVerified: true, mustChangePassword: false,
      userCompanies: { create: { companyId, isDefault: role !== 'SUPER_ADMIN' } },
    },
  });
}

type Query = Record<string, string | number | undefined>;

// A logged-in API client for one user; companyId is added the way the
// frontend's api client adds it (query for reads, body + query for writes).
export class Api {
  agent: ReturnType<typeof request.agent>;
  bearer?: string;
  constructor(app: INestApplication, public companyId?: string) {
    this.agent = request.agent(app.getHttpServer());
  }
  private q(query?: Query) { return { ...(this.companyId ? { companyId: this.companyId } : {}), ...query }; }
  private auth<T extends request.Test>(t: T) { return this.bearer ? t.set('Authorization', `Bearer ${this.bearer}`) : t; }
  get(url: string, query?: Query) { return this.auth(this.agent.get(url).query(this.q(query))); }
  del(url: string, query?: Query) { return this.auth(this.agent.delete(url).query(this.q(query))); }
  post(url: string, body: object = {}, query?: Query) { return this.auth(this.agent.post(url).query(this.q(query)).send({ ...(this.companyId ? { companyId: this.companyId } : {}), ...body })); }
  put(url: string, body: object = {}, query?: Query) { return this.auth(this.agent.put(url).query(this.q(query)).send({ ...(this.companyId ? { companyId: this.companyId } : {}), ...body })); }
  patch(url: string, body: object = {}, query?: Query) { return this.auth(this.agent.patch(url).query(this.q(query)).send({ ...(this.companyId ? { companyId: this.companyId } : {}), ...body })); }
  raw() { return this.agent; }
}

export async function login(app: INestApplication, email: string, companyId?: string, password = PASSWORD) {
  const api = new Api(app, companyId);
  const res = await api.agent.post('/api/v1/auth/login').send({ email, password });
  if (res.status >= 300) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return api;
}

export async function loginAs(ctx: TestContext, companyId: string, role: Parameters<typeof createUser>[2], tags?: string[]) {
  const user = await createUser(ctx.prisma, companyId, role, { tags });
  return { user, api: await login(ctx.app, user.email, companyId) };
}

export const bsTodayMonth = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { adToBs } = require('@easy-books/shared');
  return (adToBs(new Date()) as string).slice(0, 7);
};
export const nepalToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date());
