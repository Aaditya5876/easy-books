import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

export const PinoLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
      transport:
        config.get('NODE_ENV') !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
    },
  }),
});
