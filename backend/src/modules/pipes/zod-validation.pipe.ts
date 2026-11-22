import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

// "openingBalance" → "Opening balance", "items.0.quantity" → "Item 1 quantity".
function fieldLabel(path: PropertyKey[]): string {
  const words = path.map((p) => {
    if (typeof p === 'number') return String(p + 1);
    return String(p)
      .replace(/Id$/, '')
      .replace(/(.)Ad$/, '$1') // issuedDateAd → issued date (AD dates are the default)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase();
  });
  // "items 1 quantity" reads better as "item 1 quantity"
  const text = words.join(' ').replace(/\b(\w+)s (\d+)\b/g, '$1 $2');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Issue = ZodError['issues'][number] & Record<string, unknown>;

function describe(issue: Issue): string {
  const msg = String(issue.message ?? '');
  switch (issue.code) {
    case 'invalid_type':
      return /received undefined|required/i.test(msg) ? 'is required' : `must be a ${String(issue.expected ?? 'valid value')}`;
    case 'too_small':
      if (issue.origin === 'string') return Number(issue.minimum) <= 1 ? "can't be empty" : `must be at least ${issue.minimum} characters`;
      if (issue.origin === 'array') return Number(issue.minimum) <= 1 ? 'needs at least one entry' : `needs at least ${issue.minimum} entries`;
      return `must be ${issue.inclusive === false ? 'more than' : 'at least'} ${issue.minimum}`;
    case 'too_big':
      if (issue.origin === 'string') return `must be at most ${issue.maximum} characters`;
      return `must be ${issue.inclusive === false ? 'less than' : 'at most'} ${issue.maximum}`;
    case 'invalid_format':
      return issue.format === 'email' ? 'is not a valid email' : issue.format === 'uuid' ? 'is not a valid selection' : `is not a valid ${String(issue.format)}`;
    case 'invalid_value':
      return Array.isArray(issue.values) && issue.values.length <= 8 ? `must be one of: ${issue.values.join(', ')}` : 'has an invalid value';
    default:
      return msg || 'is invalid';
  }
}

// One readable sentence the screens can show as-is ("Vendor name is required;
// Email is not a valid email"), plus the raw per-field errors for forms that
// want to highlight fields. Before, only the raw lists were sent — no
// `message` — so every screen fell back to a vague "Failed to save".
export function zodErrorResponse(error: ZodError) {
  const parts = error.issues.slice(0, 5).map((issue) => {
    const label = fieldLabel(issue.path as PropertyKey[]);
    const text = describe(issue as Issue);
    return label ? `${label} ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
  });
  const more = error.issues.length > 5 ? ` (and ${error.issues.length - 5} more)` : '';
  return { statusCode: 400, error: 'Bad Request', message: [...new Set(parts)].join('; ') + more, errors: error.flatten() };
}

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(zodErrorResponse(result.error));
    }
    return result.data;
  }
}
