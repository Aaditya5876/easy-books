// Prisma CLI settings (migrate, generate, db seed). Prisma 7 no longer reads
// .env on its own, and the connection URL moved here from schema.prisma.
// An already-set DATABASE_URL wins over .env (the test setup relies on that).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
