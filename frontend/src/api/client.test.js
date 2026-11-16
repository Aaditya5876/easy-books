import { describe, it, expect, beforeEach } from 'vitest';
import apiClient from './client';

// Replace the network with a counting adapter.
let calls = [];
beforeEach(() => {
  calls = [];
  apiClient.defaults.adapter = async (config) => {
    calls.push(`${config.method} ${config.url} ${JSON.stringify(config.params ?? null)}`);
    await new Promise((r) => setTimeout(r, 10));
    return { data: { url: config.url }, status: 200, statusText: 'OK', headers: {}, config };
  };
});

describe('api client GET de-duplication', () => {
  it('identical GETs in flight share one request', async () => {
    const [a, b] = await Promise.all([apiClient.get('/api/v1/auth/me'), apiClient.get('/api/v1/auth/me')]);
    expect(calls).toHaveLength(1);
    expect(a.data).toEqual(b.data);
  });

  it('different params are separate requests', async () => {
    await Promise.all([
      apiClient.get('/api/v1/students', { params: { page: 1 } }),
      apiClient.get('/api/v1/students', { params: { page: 2 } }),
    ]);
    expect(calls).toHaveLength(2);
  });

  it('a later GET after the first finished goes to the network again', async () => {
    await apiClient.get('/api/v1/auth/me');
    await apiClient.get('/api/v1/auth/me');
    expect(calls).toHaveLength(2);
  });

});

describe('api client writes: Idempotency-Key and double-submit merging', () => {
  let seen = [];
  beforeEach(() => {
    seen = [];
    apiClient.defaults.adapter = async (config) => {
      seen.push({ method: config.method, url: config.url, key: config.headers?.['Idempotency-Key'], data: config.data });
      await new Promise((r) => setTimeout(r, 10));
      return { data: { ok: seen.length }, status: 201, statusText: 'Created', headers: {}, config };
    };
  });

  it('every write carries an Idempotency-Key; GETs do not', async () => {
    await apiClient.post('/api/v1/sales', { a: 1 });
    await apiClient.get('/api/v1/sales');
    expect(seen[0].key).toMatch(/^[A-Za-z0-9-]{8,}$/);
    expect(seen[1].key).toBeUndefined();
  });

  it('a double-click (identical write while the first is in flight) sends one request', async () => {
    const [a, b] = await Promise.all([apiClient.post('/api/v1/sales', { a: 1 }), apiClient.post('/api/v1/sales', { a: 1 })]);
    expect(seen).toHaveLength(1);
    expect(a.data).toEqual(b.data);
  });

  it('different bodies, or a second save after the first finished, are separate with new keys', async () => {
    await Promise.all([apiClient.post('/api/v1/sales', { a: 1 }), apiClient.post('/api/v1/sales', { a: 2 })]);
    await apiClient.post('/api/v1/sales', { a: 1 });
    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((s) => s.key)).size).toBe(3);
  });

  it('a caller-supplied key is used as-is (retry of the same action reuses it)', async () => {
    await apiClient.post('/api/v1/sales', { a: 1 }, { idempotencyKey: 'form-key-123' });
    await apiClient.post('/api/v1/sales', { a: 1 }, { idempotencyKey: 'form-key-123' });
    expect(seen.map((s) => s.key)).toEqual(['form-key-123', 'form-key-123']);
  });

  it('file uploads are not merged', async () => {
    const fd = () => { const f = new FormData(); f.append('x', '1'); return f; };
    await Promise.all([apiClient.post('/api/v1/upload', fd()), apiClient.post('/api/v1/upload', fd())]);
    expect(seen).toHaveLength(2);
  });
});
