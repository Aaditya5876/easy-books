import { createTestApp, resetDb, createCompany, loginAs, createUser, login, Api, TestContext, PASSWORD } from './helpers/app';

// Per-company setup that lets one system fit any kind of business:
// its own unit list (Kg, Strip, Plate…), set by GeoInfosys at onboarding and
// editable by the company's admin.
describe('Business setup: units', () => {
  let ctx: TestContext;
  let superAdmin: Api;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    const home = (await createCompany(ctx.prisma, { name: 'GeoInfosys', businessType: 'SERVICES', modules: [] })).id;
    const sa = await createUser(ctx.prisma, home, 'SUPER_ADMIN');
    superAdmin = await login(ctx.app, sa.email);
  });
  afterAll(async () => { await ctx.app.close(); });

  it('a new client gets the unit list GeoInfosys chose when creating it', async () => {
    const res = await superAdmin.post('/api/v1/users/provision-client', {
      companyName: 'Sita Pharmacy', businessType: 'PHARMACY', adminName: 'Sita', adminEmail: 'sita@pharmacy.test',
      units: [' Strip ', 'Bottle', 'bottle', 'Box', ''],
    });
    expect(res.status).toBe(201);
    const company = await ctx.prisma.company.findFirst({ where: { name: 'Sita Pharmacy' } });
    // trimmed, blanks dropped, duplicates (any case) removed, order kept
    expect(company!.units).toEqual(['Strip', 'Bottle', 'Box']);
  });

  it('without a list, the business type decides the starting units', async () => {
    await superAdmin.post('/api/v1/users/provision-client', {
      companyName: 'Ram Kirana', businessType: 'RETAIL', adminName: 'Ram', adminEmail: 'ram@kirana.test',
    });
    const company = await ctx.prisma.company.findFirst({ where: { name: 'Ram Kirana' } });
    expect(company!.units).toEqual(expect.arrayContaining(['Kg', 'gm', 'Litre', 'Piece', 'Packet']));
  });

  it("the company's users read the list; an older company without one gets its type's defaults", async () => {
    const old = (await createCompany(ctx.prisma, { name: 'Old Cafe', businessType: 'FOOD_BEVERAGE', modules: [] })).id;
    const staff = (await loginAs(ctx, old, 'STAFF')).api;
    const res = await staff.get(`/api/v1/companies/${old}/units`);
    expect(res.status).toBe(200);
    expect(res.body.units).toEqual(expect.arrayContaining(['Plate', 'Cup']));
  });

  it("the company's admin can change the list; staff cannot; other companies cannot", async () => {
    const co = (await createCompany(ctx.prisma, { name: 'Edit Units', businessType: 'RETAIL', modules: [] })).id;
    const admin = (await loginAs(ctx, co, 'ADMIN')).api;
    const put = await admin.put(`/api/v1/companies/${co}/units`, { units: ['Kg', 'Tray', 'Dozen'] });
    expect(put.status).toBe(200);
    expect((await admin.get(`/api/v1/companies/${co}/units`)).body.units).toEqual(['Kg', 'Tray', 'Dozen']);

    const staff = (await loginAs(ctx, co, 'STAFF')).api;
    expect((await staff.put(`/api/v1/companies/${co}/units`, { units: ['X'] })).status).toBe(403);

    const other = (await createCompany(ctx.prisma, { name: 'Other', businessType: 'RETAIL', modules: [] })).id;
    const otherAdmin = (await loginAs(ctx, other, 'ADMIN')).api;
    expect((await otherAdmin.put(`/api/v1/companies/${co}/units`, { units: ['Hack'] })).status).toBe(403);
    expect((await otherAdmin.get(`/api/v1/companies/${co}/units`)).status).toBe(403);
  });

  it('rejects an empty list and over-long unit names', async () => {
    const co = (await createCompany(ctx.prisma, { name: 'Bad Units', businessType: 'RETAIL', modules: [] })).id;
    const admin = (await loginAs(ctx, co, 'ADMIN')).api;
    expect((await admin.put(`/api/v1/companies/${co}/units`, { units: [] })).status).toBe(400);
    expect((await admin.put(`/api/v1/companies/${co}/units`, { units: ['x'.repeat(31)] })).status).toBe(400);
  });

  it('GeoInfosys can see the defaults for any business type before creating a client', async () => {
    const res = await superAdmin.get('/api/v1/companies/unit-presets');
    expect(res.status).toBe(200);
    expect(res.body.PHARMACY).toEqual(expect.arrayContaining(['Strip', 'Tablet', 'Bottle']));
    expect(res.body.DEFAULT).toEqual(expect.arrayContaining(['Piece']));
  });
});

// Item details every business can use, plus fields each business defines
// itself (Size, Colour, Weight…) — one feature instead of a pack per type.
describe('Business setup: item details and custom fields', () => {
  let ctx: TestContext;
  let admin: Api;
  let companyId: string;
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    companyId = (await createCompany(ctx.prisma, { name: 'Field Co', businessType: 'PHARMACY', modules: [] })).id;
    admin = (await loginAs(ctx, companyId, 'ADMIN')).api;
  });
  afterAll(async () => { await ctx.app.close(); });

  it('batch, expiry, alert days and supplier are saved (they used to be dropped)', async () => {
    const res = await admin.post('/api/v1/inventory', {
      itemName: 'Paracetamol 500', quantity: 50, unit: 'Strip', unitSellingPrice: 20,
      batchNo: 'B-123', expiryDate: '2027-03-31', expiryAlertDays: 45, supplierName: 'Mediline',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ batchNo: 'B-123', expiryAlertDays: 45, supplierName: 'Mediline' });
    expect(res.body.expiryDate.slice(0, 10)).toBe('2027-03-31');
    expect((await admin.put(`/api/v1/inventory/${res.body.id}`, { expiryDate: '2027-06-30', password: PASSWORD })).status).toBe(200);
    const saved = await ctx.prisma.inventoryItem.findUnique({ where: { id: res.body.id } });
    expect([saved!.batchNo, saved!.expiryDate!.toISOString().slice(0, 10)]).toEqual(['B-123', '2027-06-30']);
    expect((await admin.post('/api/v1/inventory', { itemName: 'Bad', expiryDate: 'soon' })).status).toBe(400);
    // What the Inventory page sends: no image (''), or an uploaded file path.
    expect((await admin.post('/api/v1/inventory', { itemName: 'No photo', imageUrl: '', expiryDate: '' })).status).toBe(201);
    expect((await admin.post('/api/v1/inventory', { itemName: 'With photo', imageUrl: '/uploads/abc.png' })).status).toBe(201);
  });

  it('the admin defines custom fields; keys come from the labels', async () => {
    const res = await admin.put(`/api/v1/companies/${companyId}/item-fields`, {
      fields: [
        { label: 'Size', type: 'select', options: ['S', 'M', 'L'], required: true, showInList: true },
        { label: 'Colour', type: 'text' },
        { label: 'Weight (g)', type: 'number' },
        { label: 'Made On', type: 'date' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.fields.map((f: any) => f.key)).toEqual(['size', 'colour', 'weightg', 'madeon']);
    expect((await admin.get(`/api/v1/companies/${companyId}/item-fields`)).body.fields).toHaveLength(4);
  });

  it('bad field setups are refused; staff cannot change them', async () => {
    const url = `/api/v1/companies/${companyId}/item-fields`;
    expect((await admin.put(url, { fields: [{ label: 'Size', type: 'select', options: [] }] })).status).toBe(400);
    expect((await admin.put(url, { fields: [{ label: 'A', type: 'colourwheel' }] })).status).toBe(400);
    expect((await admin.put(url, { fields: [{ label: 'Size', type: 'text' }, { label: 'size', type: 'text' }] })).status).toBe(400);
    const staff = (await loginAs(ctx, companyId, 'STAFF')).api;
    expect((await staff.put(url, { fields: [] })).status).toBe(403);
    expect((await staff.get(url)).status).toBe(200);
  });

  it('items are checked against the fields', async () => {
    const base = { itemName: 'T-Shirt', quantity: 5, unit: 'Piece', unitSellingPrice: 800 };
    expect((await admin.post('/api/v1/inventory', base)).status).toBe(400); // Size is required
    expect((await admin.post('/api/v1/inventory', { ...base, customFields: { size: 'XL' } })).status).toBe(400);
    expect((await admin.post('/api/v1/inventory', { ...base, customFields: { size: 'M', weightg: 'heavy' } })).status).toBe(400);
    expect((await admin.post('/api/v1/inventory', { ...base, customFields: { size: 'M', madeon: '31/02' } })).status).toBe(400);
    expect((await admin.post('/api/v1/inventory', { ...base, customFields: { size: 'M', nope: 1 } })).status).toBe(400);
    const ok = await admin.post('/api/v1/inventory', { ...base, customFields: { size: 'M', colour: ' Red ', weightg: '180', madeon: '2026-10-01' } });
    expect(ok.status).toBe(201);
    expect(ok.body.customFields).toEqual({ size: 'M', colour: 'Red', weightg: 180, madeon: '2026-10-01' });
    // An edit that doesn't mention custom fields leaves them alone; one that does is checked.
    expect((await admin.put(`/api/v1/inventory/${ok.body.id}`, { unitSellingPrice: 900, password: PASSWORD })).status).toBe(200);
    expect((await ctx.prisma.inventoryItem.findUnique({ where: { id: ok.body.id } }))!.customFields).toMatchObject({ size: 'M' });
    expect((await admin.put(`/api/v1/inventory/${ok.body.id}`, { customFields: { size: 'XXL' }, password: PASSWORD })).status).toBe(400);
  });

  it('the dashboard lists items that are expired or expire within their alert window', async () => {
    await admin.put(`/api/v1/companies/${companyId}/item-fields`, { fields: [] });
    const mk = (itemName: string, expiryDate: string, quantity = 10, expiryAlertDays?: number) =>
      admin.post('/api/v1/inventory', { itemName, quantity, unit: 'Strip', expiryDate, ...(expiryAlertDays ? { expiryAlertDays } : {}) });
    await mk('Expired syrup', inDays(-3));
    await mk('Soon tablets', inDays(20));            // default 30-day window
    await mk('Custom window', inDays(50), 10, 60);   // its own 60-day window
    await mk('Far future', inDays(400));
    await mk('Empty shelf', inDays(5), 0);           // nothing in stock → no alert
    const overview = (await admin.get('/api/v1/dashboard/overview')).body;
    const names = overview.inventory.expiring.map((e: any) => e.name);
    expect(names).toEqual(['Expired syrup', 'Soon tablets', 'Custom window']);
    expect(overview.inventory.expiring[0]).toMatchObject({ expired: true });
    expect(overview.inventory.expiring[1].daysLeft).toBe(20);
  });
});
