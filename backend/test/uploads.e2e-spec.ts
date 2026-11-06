import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { backfillUploadOwners } from '../core/maintenance/backfill-upload-owners';
import { createTestApp, resetDb, Api, TestContext } from './helpers/app';
import { createSchool, portalLogin, School } from './helpers/school';

// Uploaded files belong to one school: staff and parents of another school
// must not be able to open them, even with the link.
describe('Uploaded files', () => {
  let ctx: TestContext;
  let a: School;
  let b: School;
  let fileUrl: string;
  const created: string[] = [];
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

  const upload = (api: Api, companyId?: string) => {
    const req = api.agent.post('/api/v1/upload').attach('file', PNG, 'receipt.png');
    return companyId ? req.query({ companyId }) : req;
  };
  const download = (api: Api, url: string) => {
    const req = api.agent.get(url);
    return api.bearer ? req.set('Authorization', `Bearer ${api.bearer}`) : req;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    a = await createSchool(ctx, 1);
    b = await createSchool(ctx, 1);
  });
  afterAll(async () => {
    for (const f of created) fs.rmSync(path.join(process.cwd(), 'uploads', f), { force: true });
    await ctx.app.close();
  });

  it('stores the file under the uploading company', async () => {
    expect((await upload(a.admin)).status).toBe(400); // must name the company
    const res = await upload(a.admin, a.companyId);
    expect(res.status).toBe(201);
    fileUrl = res.body.url;
    created.push(path.basename(fileUrl));
    expect(path.basename(fileUrl).startsWith(`${a.companyId}_`)).toBe(true);
  });

  it("only that company's staff and parents can open it", async () => {
    expect((await download(a.admin, fileUrl)).status).toBe(200);
    expect((await download(b.admin, fileUrl)).status).toBe(403);
    expect((await download(await portalLogin(ctx, b, b.students[0]), fileUrl)).status).toBe(403);
    const parentA = await portalLogin(ctx, a, a.students[0]);
    expect((await download(parentA, fileUrl)).status).toBe(200);

    // A revoked portal token can't open files either.
    await parentA.post('/api/v1/portal/logout');
    expect((await download(parentA, fileUrl)).status).toBe(401);
  });

  it('backfill moves files uploaded before the company prefix under their owner', async () => {
    const dir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const legacy = (ext: string) => {
      const name = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(dir, name), PNG);
      return name;
    };
    const notes = legacy('.pdf');
    const qr = legacy('.png');
    const memoFile = legacy('.png');
    const orphan = legacy('.png');
    const material = await ctx.prisma.studyMaterial.create({ data: { companyId: a.companyId, title: 'Notes', fileUrl: `/uploads/${notes}` } });
    const bank = await ctx.prisma.bankAccount.create({ data: { companyId: b.companyId, bankName: 'NIC', accountNumber: '1', qrCodeUrl: `/uploads/${qr}` } });
    const memo = await ctx.prisma.memoDocument.create({ data: { companyId: a.companyId, dateAd: new Date(), attachments: [{ url: `/uploads/${memoFile}`, originalName: 'x.png' }] } });

    const result = await backfillUploadOwners(ctx.prisma, dir);
    expect(result.renamed).toBe(3);
    expect(result.orphaned).toContain(orphan);
    expect(result.orphaned).not.toContain(notes);

    const newNotes = (await ctx.prisma.studyMaterial.findUnique({ where: { id: material.id } }))!.fileUrl;
    const newQr = (await ctx.prisma.bankAccount.findUnique({ where: { id: bank.id } }))!.qrCodeUrl!;
    const newMemo = ((await ctx.prisma.memoDocument.findUnique({ where: { id: memo.id } }))!.attachments as any)[0].url;
    expect(newNotes).toBe(`/uploads/${a.companyId}_${notes}`);
    expect(newQr).toBe(`/uploads/${b.companyId}_${qr}`);
    expect(newMemo).toBe(`/uploads/${a.companyId}_${memoFile}`);
    created.push(...[newNotes, newQr, newMemo].map((u) => path.basename(u)), orphan);
    expect(fs.existsSync(path.join(dir, notes))).toBe(false);

    expect((await download(a.admin, newNotes)).status).toBe(200);
    expect((await download(b.admin, newNotes)).status).toBe(403);
    expect((await download(a.admin, newQr)).status).toBe(403);
    // Unclaimed files with no owner are no longer readable by school users.
    expect((await download(a.admin, `/uploads/${orphan}`)).status).toBe(403);
    // Running it again changes nothing.
    expect(await backfillUploadOwners(ctx.prisma, dir)).toMatchObject({ renamed: 0 });
  });

  it('portal uploads are stored under the parent\'s school', async () => {
    const parent = await portalLogin(ctx, a, a.students[0]);
    const res = await parent.agent.post('/api/v1/portal/upload').attach('file', PNG, 'proof.png');
    expect(res.status).toBe(201);
    created.push(path.basename(res.body.url));
    expect(path.basename(res.body.url).startsWith(`${a.companyId}_`)).toBe(true);
    expect((await download(b.admin, res.body.url)).status).toBe(403);
  });
});
