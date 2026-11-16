import {
  BadRequestException, CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor,
  UnprocessableEntityException, StreamableFile,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../../../core/db/psql/prisma.client';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const KEY_FORMAT = /^[A-Za-z0-9_\-:.]{8,128}$/;
// A key still "in progress" after this long belongs to a request that died
// (crash, timeout) — let the retry run instead of blocking it forever.
const STALE_MS = 2 * 60 * 1000;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

// Idempotency-Key support for every write endpoint.
//
// The browser sends one key per user action (one save, one payment) and reuses
// it if it has to retry. The first request with a key does the work and its
// response is stored; any repeat with the same key and same body gets that
// stored response back (header Idempotent-Replayed: true) instead of creating
// a second bill/payment. Same key + different body → 422; a repeat arriving
// while the first is still running → 409. A request that fails frees its key,
// so the user can fix the input and retry.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const raw = req.headers?.['idempotency-key'];
    if (raw === undefined || !WRITE_METHODS.has(req.method)) return next.handle();

    const key = Array.isArray(raw) ? raw[0] : raw;
    if (typeof key !== 'string' || !KEY_FORMAT.test(key)) {
      throw new BadRequestException('Idempotency-Key must be 8–128 letters, digits or - _ : .');
    }
    // Keys are per user; unauthenticated writes (login, portal) don't use them.
    const userId: string | undefined = req.user?.sub;
    if (!userId) return next.handle();

    const path = String(req.originalUrl ?? req.url).split('?')[0];
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ m: req.method, p: path, q: req.query ?? {}, b: req.body ?? null }))
      .digest('hex');
    const where = { userId_key: { userId, key } };

    const claimed = await this.claim(userId, key, req.method, path, requestHash);
    if (!claimed) {
      const existing = await this.prisma.idempotencyKey.findUnique({ where });
      if (!existing) throw new ConflictException('Please retry the request');
      if (existing.requestHash !== requestHash) {
        throw new UnprocessableEntityException('This Idempotency-Key was already used for a different request');
      }
      if (!existing.completedAt) {
        if (Date.now() - existing.createdAt.getTime() < STALE_MS) {
          throw new ConflictException('The same request is still being processed');
        }
        // Abandoned attempt: take it over and run again.
        await this.prisma.idempotencyKey.update({ where, data: { createdAt: new Date() } });
      } else {
        res.setHeader('Idempotent-Replayed', 'true');
        if (existing.statusCode) res.status(existing.statusCode);
        return of(existing.response);
      }
    }

    return next.handle().pipe(
      mergeMap((body) => from(this.complete(where, res, body))),
      catchError((err) => from(this.prisma.idempotencyKey.delete({ where }).catch(() => undefined)).pipe(mergeMap(() => throwError(() => err)))),
    );
  }

  private async claim(userId: string, key: string, method: string, path: string, requestHash: string) {
    try {
      await this.prisma.idempotencyKey.create({ data: { userId, key, method, path, requestHash } });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    }
  }

  private async complete(where: { userId_key: { userId: string; key: string } }, res: any, body: unknown) {
    // Files/streams can't be replayed — don't keep the key for them.
    if (body instanceof StreamableFile || Buffer.isBuffer(body)) {
      await this.prisma.idempotencyKey.delete({ where }).catch(() => undefined);
      return body;
    }
    const response = body === undefined ? Prisma.JsonNull : JSON.parse(JSON.stringify(body));
    // Nest applies the route's status code after interceptors run; POST is 201.
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : undefined;
    await this.prisma.idempotencyKey.update({ where, data: { response, statusCode, completedAt: new Date() } });
    return body;
  }
}
