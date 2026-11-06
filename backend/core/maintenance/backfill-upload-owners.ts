import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// One-time move of files uploaded before filenames carried their company:
// `/uploads/<uuid>.ext` → `/uploads/<companyId>_<uuid>.ext`, found through the
// rows that link to them, with those links rewritten. UploadAccessGuard only
// lets a school's own staff and parents open prefixed files, and refuses
// unprefixed ones to everyone but the platform owner — so run this before
// deploying that guard. Safe to re-run: prefixed files are skipped.

const LEGACY_NAME = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]+';
const LEGACY_LINK = new RegExp(`/uploads/(${LEGACY_NAME})`, 'gi');
const LEGACY_FILE = new RegExp(`^${LEGACY_NAME}$`, 'i');

// Every column that stores links to uploaded files.
const SOURCES = [
  { model: 'company', fields: ['logoUrl'], owner: 'id' },
  { model: 'bankAccount', fields: ['qrCodeUrl'], owner: 'companyId' },
  { model: 'inventoryItem', fields: ['imageUrl'], owner: 'companyId' },
  { model: 'memoDocument', fields: ['documentUrl', 'attachments'], owner: 'companyId' },
  { model: 'feePayment', fields: ['proofScreenshotUrl'], owner: 'companyId' },
  { model: 'studyMaterial', fields: ['fileUrl'], owner: 'companyId' },
  { model: 'homework', fields: ['fileUrl'], owner: 'companyId' },
] as const;

export async function backfillUploadOwners(prisma: PrismaClient, uploadDir: string) {
  const owners = new Map<string, string>(); // legacy filename → companyId
  let renamed = 0;

  for (const { model, fields, owner } of SOURCES) {
    const delegate = (prisma as any)[model];
    const rows: any[] = await delegate.findMany({
      select: { id: true, [owner]: true, ...Object.fromEntries(fields.map((f) => [f, true])) },
    });
    for (const row of rows) {
      const companyId: string = row[owner];
      const data: Record<string, unknown> = {};
      for (const field of fields) {
        const value = row[field];
        if (value == null) continue;
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        const rewritten = text.replace(LEGACY_LINK, (_m, name: string) => {
          if (!owners.has(name)) owners.set(name, companyId);
          return `/uploads/${owners.get(name)}_${name}`;
        });
        if (rewritten === text) continue;
        data[field] = typeof value === 'string' ? rewritten : JSON.parse(rewritten);
      }
      if (Object.keys(data).length) await delegate.update({ where: { id: row.id }, data });
    }
  }

  for (const [name, companyId] of owners) {
    const from = path.join(uploadDir, name);
    if (!fs.existsSync(from)) continue; // link to a file that's already gone
    fs.renameSync(from, path.join(uploadDir, `${companyId}_${name}`));
    renamed++;
  }

  // Files no row links to: left in place, readable only by the platform owner.
  const orphaned = fs.existsSync(uploadDir)
    ? fs.readdirSync(uploadDir).filter((f) => LEGACY_FILE.test(f))
    : [];
  return { renamed, orphaned };
}
