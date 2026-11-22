import { BadRequestException } from '@nestjs/common';

// Small checks for handlers that take a loose body (no zod schema): turn bad
// input into a clear 400 instead of a crash (500) deeper down.

export function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

export function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`${label} must be text`);
  return value.trim() || undefined;
}

export function requireDate(value: unknown, label: string): Date {
  const d = typeof value === 'string' && value.trim() ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) throw new BadRequestException(`${label} must be a valid date`);
  return d;
}

export function optionalDate(value: unknown, label: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireDate(value, label);
}

export function optionalAmount(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${label} must be a number, 0 or more`);
  return n;
}

export function stringList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw new BadRequestException(`${label} must be a list`);
  return value as string[];
}
