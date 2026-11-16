import { z } from 'zod';

type NoDefaults<T extends z.ZodRawShape> = {
  [K in keyof T]: T[K] extends z.ZodDefault<infer Inner> ? Inner : T[K];
};

// zod 4 applies a field's .default() even inside .partial(), so an update
// schema derived from a create schema re-sends every default on every edit —
// e.g. a phone-number change reset an employee's salary to 0. Build update
// schemas from the create shape with the defaults taken off.
export function withoutDefaults<T extends z.ZodRawShape>(shape: T): NoDefaults<T> {
  return Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.unwrap() : field]),
  ) as NoDefaults<T>;
}
