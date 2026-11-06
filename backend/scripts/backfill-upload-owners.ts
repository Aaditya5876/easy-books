// Run once per environment, before deploying the per-school file access guard:
//   npm run backfill:uploads --workspace=backend
// Uses DATABASE_URL from backend/.env and the backend's uploads/ folder.
import 'dotenv/config';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { prismaPgAdapter } from '../core/db/psql/prisma.client';
import { backfillUploadOwners } from '../core/maintenance/backfill-upload-owners';

async function main() {
  const prisma = new PrismaClient({ adapter: prismaPgAdapter() });
  try {
    const { renamed, orphaned } = await backfillUploadOwners(prisma, path.join(process.cwd(), 'uploads'));
    console.log(`Moved ${renamed} file(s) under their school.`);
    if (orphaned.length) console.log(`${orphaned.length} file(s) aren't linked from any record (only the platform owner can open them):\n  ${orphaned.join('\n  ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
