import { describe, it, expect } from 'vitest';
import { getTourSteps, getGuideSections, GUIDE_SECTIONS, GUIDE_GROUPS } from './guideContent';
import { tourMode } from './tour';

const ids = (steps) => steps.map((s) => s.id);

describe('tourMode', () => {
  it('platform for a super admin with no client selected', () => {
    expect(tourMode({ role: 'SUPER_ADMIN', defaultCompanyId: null })).toBe('platform');
  });
  it('school or business from the active company', () => {
    expect(tourMode({ role: 'SUPER_ADMIN', defaultCompanyId: 'c', defaultCompany: { businessType: 'SCHOOL' } })).toBe('school');
    expect(tourMode({ role: 'ADMIN', defaultCompanyId: 'c', defaultCompany: { businessType: 'RETAIL' } })).toBe('business');
  });
});

describe('tour steps', () => {
  it('every tour starts with a welcome and ends on finish', () => {
    for (const mode of ['platform', 'school', 'business']) {
      const steps = getTourSteps(mode, 'ADMIN');
      expect(steps[0].id).toBe('welcome');
      expect(steps.at(-1).finish).toBe(true);
    }
  });

  it('school admin walks the setup order: staff → classes → subjects → students → fees', () => {
    const s = ids(getTourSteps('school', 'ADMIN'));
    const order = ['employees', 'classes', 'subjects', 'students', 'fees'].map((id) => s.indexOf(id));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s).toContain('settings');
  });

  it('teachers get their own steps and none of the admin-only ones', () => {
    const s = ids(getTourSteps('school', 'TEACHER'));
    expect(s).toEqual(expect.arrayContaining(['classes-teacher', 'students-teacher', 'homework', 'my-attendance']));
    for (const adminOnly of ['employees', 'fees', 'payroll', 'settings', 'ledger']) expect(s).not.toContain(adminOnly);
  });

  it('accountants see fees, ledger and payroll but not settings', () => {
    const s = ids(getTourSteps('school', 'ACCOUNTANT'));
    expect(s).toEqual(expect.arrayContaining(['fees', 'ledger', 'payroll']));
    expect(s).not.toContain('settings');
  });

  it('every step that points at the screen names a target', () => {
    for (const mode of ['platform', 'school', 'business']) {
      for (const role of ['ADMIN', 'ACCOUNTANT', 'STAFF', 'TEACHER']) {
        for (const step of getTourSteps(mode, role)) {
          if (step.id !== 'welcome' && step.id !== 'finish') expect(step.target, `${mode}/${role}/${step.id}`).toBeTruthy();
          expect(step.title && step.body).toBeTruthy();
        }
      }
    }
  });
});

describe('guide sections', () => {
  it('every section has a known group, icon, title and at least one block', () => {
    const groups = new Set(GUIDE_GROUPS.map((g) => g.id));
    for (const s of GUIDE_SECTIONS) {
      expect(groups.has(s.group), s.id).toBe(true);
      expect(s.icon && s.title && s.summary, s.id).toBeTruthy();
      expect(s.blocks.length, s.id).toBeGreaterThan(0);
    }
  });

  it('section ids are unique (they are anchors and translation keys)', () => {
    const all = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('schools see school topics, businesses see business topics', () => {
    const school = getGuideSections({ mode: 'school', role: 'ADMIN' }).map((s) => s.id);
    const business = getGuideSections({ mode: 'business', role: 'ADMIN' }).map((s) => s.id);
    expect(school).toEqual(expect.arrayContaining(['first-steps-school', 'fees', 'automation']));
    expect(school).not.toContain('sales');
    expect(business).toEqual(expect.arrayContaining(['first-steps-business', 'sales']));
    expect(business).not.toContain('fees');
  });

  it('role-restricted sections are hidden from other roles (super admin sees all)', () => {
    const teacher = getGuideSections({ mode: 'school', role: 'TEACHER' }).map((s) => s.id);
    expect(teacher).not.toContain('payroll');
    expect(teacher).not.toContain('settings');
    const owner = getGuideSections({ mode: 'school', role: 'SUPER_ADMIN' }).map((s) => s.id);
    expect(owner).toEqual(expect.arrayContaining(['payroll', 'settings', 'fees']));
  });

  it('the platform owner gets the client set-up guide', () => {
    expect(getGuideSections({ mode: 'platform', role: 'SUPER_ADMIN' }).map((s) => s.id)).toContain('platform-clients');
  });
});
