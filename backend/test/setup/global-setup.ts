// Creates the test database if it doesn't exist and brings it up to the
// latest migration — the same `migrate deploy` production uses.
import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { TEST_DATABASE_URL } from './env';

export default async function globalSetup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!/_test$/.test(dbName)) throw new Error(`Refusing to run tests against non-test database "${dbName}"`);

  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = '/postgres';
  const prisma = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  const exists = await prisma.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
  if (exists.length === 0) await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await prisma.$disconnect();

  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
