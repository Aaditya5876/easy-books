import { describe, it, expect, beforeEach } from 'vitest';
import { getPortalSession, setPortalSession, clearPortalSession } from './portalSession';
import apiClient from '@/api/client';

// The portal token lives in an HttpOnly cookie the page can't read; the page
// only keeps a non-secret marker of the session for routing.
let store;
beforeEach(() => {
  store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  globalThis.window = { location: { href: '' } };
});

describe('portal session marker', () => {
  it('stores routing hints, never a token', () => {
    setPortalSession({ mustChangePassword: true, student: { name: 'Sita' }, token: 'eyJ.secret' });
    expect(getPortalSession()).toEqual({ mustChangePassword: true });
    expect(JSON.stringify(store)).not.toContain('eyJ');
    clearPortalSession();
    expect(getPortalSession()).toBeNull();
  });

  it('drops tokens left in storage by the old Bearer login', () => {
    store.portal_token = 'eyJ.old';
    clearPortalSession();
    expect(store.portal_token).toBeUndefined();
  });
});

describe('expired portal session', () => {
  it('sends the parent to the portal login, not the staff login, without a staff refresh', async () => {
    setPortalSession({ mustChangePassword: false });
    const calls = [];
    apiClient.defaults.adapter = async (config) => {
      calls.push(config.url);
      const err = new Error('401');
      err.config = config;
      err.response = { status: 401, data: {}, headers: {}, config };
      throw err;
    };
    await expect(apiClient.get('/api/v1/portal/me')).rejects.toBeTruthy();
    expect(calls).toEqual(['/api/v1/portal/me']);
    expect(window.location.href).toBe('/portal/login');
    expect(getPortalSession()).toBeNull();
  });
});
