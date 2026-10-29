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

  it('writes are never de-duplicated', async () => {
    await Promise.all([apiClient.post('/api/v1/x', {}), apiClient.post('/api/v1/x', {})]);
    expect(calls).toHaveLength(2);
  });
});
