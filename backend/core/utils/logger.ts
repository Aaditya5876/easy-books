import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

// File links carry the session token as ?token= (an <img> can't send headers).
const maskTokenParam = (url?: string) => url?.replace(/([?&]token=)[^&]*/gi, '$1[Redacted]');

export function pinoHttpOptions(nodeEnv?: string) {
  return {
    level: nodeEnv === 'test' ? 'silent' : nodeEnv === 'production' ? 'info' : 'debug',
    // Session cookies and bearer tokens would otherwise land in the logs verbatim.
    redact: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.query.token',
      'res.headers["set-cookie"]',
    ],
    serializers: {
      req: (req: any) => {
        req.url = maskTokenParam(req.url);
        return req;
      },
    },
    // pino-pretty runs as a worker-thread transport that serverless bundles
    // (Vercel) don't trace, so it crashes at boot there — local dev only.
    transport:
      nodeEnv === 'development' && !process.env.VERCEL
        ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
        : undefined,
  };
}

export const PinoLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: pinoHttpOptions(config.get('NODE_ENV')),
  }),
});
