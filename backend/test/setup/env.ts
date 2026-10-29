// Runs before every test file: point the app at the throwaway test database
// (never the dev one) and put it in test mode (no throttling, no queue, no logs).
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://easybooksuser:easybookspass@localhost:5433/easybooks_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.CRON_SECRET = 'test-cron-secret';
delete process.env.VERCEL;
