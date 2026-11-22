import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/bills';

// Safety net for failed requests that no screen handled itself. Before this,
// a Save whose handler had no try/catch (18 of them, found by an audit) failed
// silently: the dialog just sat there with no message. Screens that handle
// their own errors are unaffected — only errors nobody caught reach here.

let lastShown = { text: '', at: 0 };

export function messageForError(err, fallback) {
  if (err?.response) return apiErrorMessage(err, fallback);
  if (err?.isAxiosError || err?.code === 'ERR_NETWORK') {
    return "Can't reach the server — check your connection and try again. Nothing was saved.";
  }
  return null; // not a request error
}

export function showRequestError(err, fallback = 'Something went wrong — nothing was saved. Please try again.') {
  // A 401 is handled by the session refresh / redirect to login.
  if (err?.response?.status === 401) return;
  const text = messageForError(err, fallback);
  if (!text) return;
  // The same failure reported twice in a row (e.g. a retry) shows once.
  const now = Date.now();
  if (text === lastShown.text && now - lastShown.at < 1500) return;
  lastShown = { text, at: now };
  toast.error(text);
}

export function installGlobalErrorToasts() {
  window.addEventListener('unhandledrejection', (event) => {
    if (!messageForError(event.reason, '')) return; // leave real code errors to the console
    event.preventDefault();
    showRequestError(event.reason);
  });
}
