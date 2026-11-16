import { useMemo, useRef } from 'react';
import { newIdempotencyKey } from '@/api/client';

// One Idempotency-Key per user action (one bill, one payment). Pass
// `{ idempotencyKey: idem.key }` with the save request and call `idem.renew()`
// once it succeeds. If the save fails on a network error and the user clicks
// again, the same key goes out and the server returns the first result
// instead of recording the money twice.
export function useIdempotencyKey() {
  const ref = useRef(newIdempotencyKey());
  return useMemo(() => ({
    get key() { return ref.current; },
    renew() { ref.current = newIdempotencyKey(); },
  }), []);
}
