import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const BullRootModule = BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    },
  }),
});

export const QUEUE_NAMES = {
  PAYROLL: 'payroll',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
} as const;
