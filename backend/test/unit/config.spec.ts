import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from '../../core/config';

// The backend reads its settings through ConfigModule.forRoot({ validate: validateEnv }).
// Since @nestjs/config 12, only what the validator RETURNS reaches ConfigService
// and process.env. When validateEnv dropped undeclared keys, every setting that
// lived only in backend/.env (SMTP_*, GEMINI_API_KEY, SMS, eSewa/Khalti…) vanished
// in local dev: invite emails failed with 'Missing credentials for "PLAIN"'.
// (Production was unaffected — Vercel provides real env vars.)
describe('backend settings (core/config.ts)', () => {
  const REQUIRED = { DATABASE_URL: 'postgresql://u:p@h/db', JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'b', JWT_SECRET: 'c' };

  it('keeps settings it does not declare, and still converts the ones it does', () => {
    const env = validateEnv({ ...REQUIRED, SMTP_HOST: 'smtp.gmail.com', PORT: '4000' });
    expect(env).toMatchObject({ SMTP_HOST: 'smtp.gmail.com', PORT: 4000, REDIS_PORT: 6379 });
  });

  it('still refuses to start without a required setting', () => {
    const { JWT_SECRET: _omit, ...missingOne } = REQUIRED;
    expect(() => validateEnv(missingOne)).toThrow(/JWT_SECRET/);
  });

  it('a value only in the .env file reaches ConfigService and process.env', async () => {
    const key = 'EB_FILE_ONLY_SETTING_FOR_TEST';
    delete process.env[key];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-config-'));
    const envFile = path.join(dir, '.env');
    fs.writeFileSync(envFile, `${key}=from-env-file\n`);

    @Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: envFile, validate: validateEnv })] })
    class SettingsOnly {}

    const app = await NestFactory.createApplicationContext(SettingsOnly, { logger: false });
    try {
      expect(app.get(ConfigService).get(key)).toBe('from-env-file');
      expect(process.env[key]).toBe('from-env-file');
    } finally {
      await app.close();
      delete process.env[key];
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
