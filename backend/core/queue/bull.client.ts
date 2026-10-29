import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

// Serverless (Vercel) has no Redis and no long-lived worker to drain a queue,
// so queues and in-process cron timers are off there: payroll runs inline and
// scheduled tasks are triggered by Vercel Cron via CronController.
// Tests take the same inline path so payroll results are deterministic.
export const QUEUES_ENABLED = !process.env.VERCEL && process.env.NODE_ENV !== 'test';

export const BullRootModule =BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    },
  }),
});

export const QUEUE_NAMES = {
  PAYROLL: 'payroll',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
} as const;
