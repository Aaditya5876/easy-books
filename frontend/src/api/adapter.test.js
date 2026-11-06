import { describe, it, expect, beforeEach } from 'vitest';
import apiClient from './client';
import { api } from './adapter';

// The backend rejects record-level calls that don't name a company, so the
// adapter must send the active company with every one of them.
let calls = [];
beforeEach(() => {
  calls = [];
  globalThis.localStorage = { getItem: (k) => (k === 'easybooks_active_company' ? 'co-1' : null) };
  apiClient.defaults.adapter = async (config) => {
    calls.push({ method: config.method, url: config.url, params: config.params ?? null });
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
});

describe('api adapter company scope', () => {
  it('sends the active companyId on get, update, delete and list', async () => {
    await api.Employee.get('e1');
    await api.Employee.update('e1', { name: 'X' });
    await api.InventoryItem.delete('i1');
    await api.Task.list();
    expect(calls.map((c) => c.params?.companyId)).toEqual(['co-1', 'co-1', 'co-1', 'co-1']);
  });

  it('keeps a companyId the caller passed', async () => {
    await api.Client.filter({ company_id: 'co-2' });
    expect(calls[0].params.companyId).toBe('co-2');
  });

  it('leaves user-scoped Company routes alone', async () => {
    await api.Company.get('co-9');
    expect(calls[0].params?.companyId).toBeUndefined();
  });
});
