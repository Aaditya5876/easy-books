import { describe, it, expect } from 'vitest';
import { messageForError } from './globalErrors';

// The safety net only speaks for failed requests, with the server's own words.
describe('messageForError', () => {
  it("uses the server's message", () => {
    expect(messageForError({ response: { status: 400, data: { message: 'Vendor name is required' } } }, 'x')).toBe('Vendor name is required');
  });
  it('falls back when the server gave no message', () => {
    expect(messageForError({ response: { status: 500, data: {} } }, 'Something went wrong')).toBe('Something went wrong');
  });
  it('explains a lost connection', () => {
    expect(messageForError({ isAxiosError: true, code: 'ERR_NETWORK' }, 'x')).toMatch(/Can't reach the server/);
  });
  it('ignores ordinary code errors (they stay in the console)', () => {
    expect(messageForError(new TypeError('x is undefined'), 'x')).toBeNull();
  });
});
