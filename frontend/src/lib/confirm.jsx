import { useState, useEffect } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

let listener = null;

/**
 * Promise-based replacement for window.confirm(). Usage:
 *   if (!(await confirm({ title: 'Remove user?', description: '...' }))) return;
 * Accepts a plain string too: confirm('Delete this item?')
 */
export function confirm(options) {
  const opts = typeof options === 'string' ? { description: options } : options;
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm(opts.description || opts.title || 'Are you sure?'));
      return;
    }
    listener({ ...opts, resolve });
  });
}

/**
 * Single-button informational popup (no Cancel) built on the same dialog —
 * for messages that need more visibility than a corner toast, e.g. "contact
 * GeoInfosys" errors. Usage: await alertPopup({ title: '...', description: '...' })
 * Accepts a plain string too: alertPopup('Something happened')
 */
export function alertPopup(options) {
  const opts = typeof options === 'string' ? { description: options } : options;
  return new Promise((resolve) => {
    if (!listener) {
      window.alert(opts.description || opts.title || '');
      resolve(true);
      return;
    }
    listener({ ...opts, alertOnly: true, resolve });
  });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    listener = (next) => setState(next);
    return () => { listener = null; };
  }, []);

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title || 'Are you sure?'}</AlertDialogTitle>
          {state?.description && (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!state?.alertOnly && (
            <AlertDialogCancel onClick={() => close(false)}>
              {state?.cancelLabel || 'Cancel'}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={() => close(true)}
            className={state?.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
          >
            {state?.confirmLabel || (state?.alertOnly ? 'OK' : 'Confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
