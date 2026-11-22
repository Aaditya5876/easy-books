import { describe, it, expect } from 'vitest';
import { trialDaysGivenUp } from '@easy-books/shared';
import { planState, defaultAmount, projectedExpiry, perMonth, expiryTimerDelay } from './subscription';

const prices = [
  { tier: 'BASIC', installationFee: 8000, monthly: 500, quarterly: 1800, halfYearly: 2950, yearly: 4530 },
  { tier: 'STANDARD', installationFee: 12000, monthly: 850, quarterly: 3100, halfYearly: 5200, yearly: 9500 },
];

describe('planState', () => {
  it('a company set up before plans existed has no plan and no expiry', () => {
    expect(planState({ planTier: null, subscriptionExpiresAt: null, daysLeft: null })).toEqual({ status: 'LEGACY', tone: 'muted' });
  });
  it('a trial is a trial until it runs out', () => {
    expect(planState({ planTier: 'PREMIUM', planStatus: 'TRIAL', daysLeft: 20, isExpired: false })).toEqual({ status: 'TRIAL', tone: 'info' });
    expect(planState({ planTier: 'PREMIUM', planStatus: 'TRIAL', daysLeft: 0, isExpired: true })).toEqual({ status: 'EXPIRED', tone: 'danger' });
  });
  it('a bought plan warns in the last 30 days, urgently in the last 7', () => {
    expect(planState({ planTier: 'BASIC', planStatus: 'ACTIVE', daysLeft: 200 })).toEqual({ status: 'ACTIVE', tone: 'ok' });
    expect(planState({ planTier: 'BASIC', planStatus: 'ACTIVE', daysLeft: 25 })).toEqual({ status: 'ACTIVE', tone: 'warn' });
    expect(planState({ planTier: 'BASIC', planStatus: 'ACTIVE', daysLeft: 3 })).toEqual({ status: 'ACTIVE', tone: 'danger' });
  });
});

describe('defaultAmount', () => {
  it('first purchase = installation fee; renewal = the period price of the chosen tier', () => {
    expect(defaultAmount(prices, 'BASIC', 'ACTIVATE')).toBe(8000);
    expect(defaultAmount(prices, 'STANDARD', 'RENEW', 'QUARTERLY')).toBe(3100);
    expect(defaultAmount(prices, 'STANDARD', 'RENEW', 'HALF_YEARLY')).toBe(5200);
  });
  it('is empty when the price is unknown', () => {
    expect(defaultAmount(prices, 'PREMIUM', 'RENEW', 'YEARLY')).toBe('');
  });
});

describe('projectedExpiry', () => {
  const now = new Date('2026-11-22T10:00:00Z');
  it('activation: a year from today', () => {
    expect(projectedExpiry({ mode: 'ACTIVATE', now }).toISOString()).toBe('2027-11-22T10:00:00.000Z');
  });
  it('activation during the trial: a year from when the trial ends (no trial days lost)', () => {
    expect(projectedExpiry({ mode: 'ACTIVATE', trialEndsAt: '2026-12-10T10:00:00Z', now }).toISOString()).toBe('2027-12-10T10:00:00.000Z');
  });
  it('activation after the trial ran out: a year from today', () => {
    expect(projectedExpiry({ mode: 'ACTIVATE', trialEndsAt: '2026-11-01T10:00:00Z', now }).toISOString()).toBe('2027-11-22T10:00:00.000Z');
  });
  it('early renewal adds on top of the current expiry', () => {
    expect(projectedExpiry({ mode: 'RENEW', period: 'QUARTERLY', currentExpiry: '2027-01-10T10:00:00Z', now }).toISOString()).toBe('2027-04-10T10:00:00.000Z');
  });
  it('after expiry it counts from today', () => {
    expect(projectedExpiry({ mode: 'RENEW', period: 'MONTHLY', currentExpiry: '2026-10-01T00:00:00Z', now }).toISOString()).toBe('2026-12-22T10:00:00.000Z');
  });
});

describe('trialDaysGivenUp (cheaper plan picked while the Premium trial runs)', () => {
  const now = new Date('2026-11-22T10:00:00Z');
  const trial = { planTier: 'PREMIUM', planStatus: 'TRIAL', trialEndsAt: '2026-12-04T10:00:00Z' };
  it('Basic or Standard during the trial: the trial days left', () => {
    expect(trialDaysGivenUp(trial, 'BASIC', now)).toBe(12);
    expect(trialDaysGivenUp(trial, 'STANDARD', now)).toBe(12);
  });
  it('Premium gives nothing up', () => {
    expect(trialDaysGivenUp(trial, 'PREMIUM', now)).toBe(0);
  });
  it('trial over, bought plan, or no plan: nothing to give up', () => {
    expect(trialDaysGivenUp({ ...trial, trialEndsAt: '2026-11-01T00:00:00Z' }, 'BASIC', now)).toBe(0);
    expect(trialDaysGivenUp({ ...trial, planStatus: 'ACTIVE' }, 'BASIC', now)).toBe(0);
    expect(trialDaysGivenUp({ planTier: null, planStatus: null, trialEndsAt: null }, 'BASIC', now)).toBe(0);
    expect(trialDaysGivenUp(null, 'BASIC', now)).toBe(0);
  });
});

describe('perMonth', () => {
  it('per-month cost of each period', () => {
    expect(perMonth(prices[0], 'YEARLY')).toBe(378);
    expect(perMonth(prices[0], 'QUARTERLY')).toBe(600);
  });
});

describe('expiryTimerDelay', () => {
  const now = new Date('2026-11-22T10:00:00Z').getTime();
  it('past or now: show right away (0)', () => {
    expect(expiryTimerDelay('2026-11-22T09:00:00Z', now)).toBe(0);
  });
  it('soon: wait exactly until then', () => {
    expect(expiryTimerDelay('2026-11-22T10:00:05Z', now)).toBe(5000);
  });
  it('more than ~24.8 days away: no timer (setTimeout would fire immediately)', () => {
    expect(expiryTimerDelay('2026-12-22T10:00:00Z', now)).toBeNull();
    expect(expiryTimerDelay('2027-11-22T10:00:00Z', now)).toBeNull();
  });
  it('no or bad date: no timer', () => {
    expect(expiryTimerDelay(null, now)).toBeNull();
    expect(expiryTimerDelay('not a date', now)).toBeNull();
  });
});
