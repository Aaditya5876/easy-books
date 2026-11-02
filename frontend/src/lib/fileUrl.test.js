import { describe, it, expect } from 'vitest';
import apiClient from '@/api/client';
import { fileUrl } from './fileUrl';

// Stored links are API-relative (/uploads/<name>); the page runs on another
// origin, so they need the API base to open.
describe('fileUrl', () => {
  it('prefixes stored /uploads links with the API origin', () => {
    expect(fileUrl('/uploads/co_a.pdf')).toBe(`${apiClient.defaults.baseURL}/uploads/co_a.pdf`);
  });
  it('leaves absolute and in-browser URLs alone', () => {
    expect(fileUrl('https://x.np/a.png')).toBe('https://x.np/a.png');
    expect(fileUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
    expect(fileUrl('')).toBe('');
  });
});
