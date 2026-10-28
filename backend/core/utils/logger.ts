import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

export const PinoLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
      // pino-pretty runs as a worker-thread transport that serverless bundles
      // (Vercel) don't trace, so it crashes at boot there — local dev only.
      transport:
        config.get('NODE_ENV') !== 'production' && !process.env.VERCEL
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
    },
  }),
});
