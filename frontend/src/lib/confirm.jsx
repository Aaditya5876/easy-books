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
          <AlertDialogCancel onClick={() => close(false)}>
            {state?.cancelLabel || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={state?.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
          >
            {state?.confirmLabel || 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
