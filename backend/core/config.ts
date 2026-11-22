import { z } from 'zod';

// looseObject, not object: the settings listed here are required/converted, but
// every other one (SMTP_*, GEMINI_API_KEY, SMS, eSewa/Khalti, Blob…) must be
// kept. Since @nestjs/config 12, only what validateEnv returns reaches
// ConfigService and process.env — a strict object silently dropped every
// setting that lives only in backend/.env (local invite emails then failed
// with 'Missing credentials for "PLAIN"'). See test/unit/config.spec.ts.
const EnvSchema = z.looseObject({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  // Signs/verifies parent/student portal tokens (PortalGuard) — required, not
  // defaulted, so a deployment that forgets to set it fails to boot instead
  // of silently running on a hardcoded, guessable fallback secret.
  JWT_SECRET: z.string(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${result.error.toString()}`);
  }
  return result.data;
}
