import { describe, it, expect } from 'vitest';
import { designationOptions } from './designations';

describe('designationOptions', () => {
  it("offers the company type's job titles", () => {
    expect(designationOptions('FOOD_BEVERAGE')).toEqual(expect.arrayContaining(['Cashier', 'Baker', 'Waiter']));
    expect(designationOptions('SCHOOL')).toContain('Principal');
  });
  it('adds titles already used in the company and the current value, without duplicates', () => {
    const opts = designationOptions('FOOD_BEVERAGE', ['Pastry Chef', 'cashier', ''], 'Head Baker');
    expect(opts).toContain('Pastry Chef');
    expect(opts).toContain('Head Baker');
    expect(opts.filter((o) => o.toLowerCase() === 'cashier')).toHaveLength(1);
  });
  it('falls back to common titles for an unknown business type', () => {
    expect(designationOptions('Restaurant / Tea Shop / Bakery')).toContain('Manager');
  });
});
