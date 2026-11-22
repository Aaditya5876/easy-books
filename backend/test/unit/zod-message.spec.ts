import { z } from 'zod';
import { zodErrorResponse } from '../../src/modules/pipes/zod-validation.pipe';

// A rejected form must come back with a sentence the screen can show.
describe('validation error messages', () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    openingBalance: z.number().min(0).optional(),
    accountType: z.enum(['ASSET', 'LIABILITY']),
    items: z.array(z.object({ quantity: z.number().positive() })).min(1),
  });
  const msg = (body: unknown) => zodErrorResponse(schema.safeParse(body).error!).message;

  it('names each problem field in plain words', () => {
    expect(msg({ accountType: 'ASSET', items: [{ quantity: 1 }] })).toBe('Name is required');
    expect(msg({ name: '', accountType: 'ASSET', items: [{ quantity: 1 }] })).toBe("Name can't be empty");
    expect(msg({ name: 'A', email: 'nope', accountType: 'ASSET', items: [{ quantity: 1 }] })).toBe('Email is not a valid email');
    expect(msg({ name: 'A', openingBalance: -5, accountType: 'ASSET', items: [{ quantity: 1 }] })).toBe('Opening balance must be at least 0');
    expect(msg({ name: 'A', accountType: 'MAGIC', items: [{ quantity: 1 }] })).toBe('Account type must be one of: ASSET, LIABILITY');
    expect(msg({ name: 'A', accountType: 'ASSET', items: [] })).toBe('Items needs at least one entry');
    expect(msg({ name: 'A', accountType: 'ASSET', items: [{ quantity: 0 }] })).toBe('Item 1 quantity must be more than 0');
  });

  it('lists several problems in one sentence and keeps the per-field detail', () => {
    const res = zodErrorResponse(schema.safeParse({}).error!);
    expect(res.message).toContain('Name is required');
    expect(res.message).toContain('Account type');
    expect(res.errors.fieldErrors).toHaveProperty('name');
  });
});
