import { Writable } from 'stream';
import pinoHttp from 'pino-http';
import { pinoHttpOptions } from '../../core/utils/logger';

// Request logs must never contain session cookies, bearer tokens, or the
// ?token= that file links carry.
describe('request logger', () => {
  it('redacts credentials from logged requests', () => {
    let out = '';
    const sink = new Writable({ write(chunk, _enc, cb) { out += chunk; cb(); } });
    const logger = pinoHttp({ ...pinoHttpOptions('production'), transport: undefined }, sink);

    const req: any = {
      method: 'GET', url: '/uploads/a.png?token=SECRET-QUERY', originalUrl: '/uploads/a.png?token=SECRET-QUERY',
      query: { token: 'SECRET-QUERY' },
      headers: { cookie: 'accessToken=SECRET-COOKIE', authorization: 'Bearer SECRET-BEARER', 'user-agent': 'jest' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res: any = Object.assign(new Writable({ write: (_c, _e, cb) => cb() }), {
      statusCode: 200, getHeaders: () => ({ 'set-cookie': ['refreshToken=SECRET-SETCOOKIE'] }),
      getHeader: () => undefined, setHeader: () => undefined,
    });
    logger(req, res);
    req.log.info('hello');

    expect(out).toContain('hello');
    expect(out).toContain('/uploads/a.png');
    expect(out).not.toMatch(/SECRET-/);
  });
});
