// src/hooks/useBackToClose.js — the phone's Back button (or gesture) closes
// an open sheet, drawer or dialog instead of leaving the page.
//
// Opening adds a history entry for the same address; Back removes it and
// closes the overlay. Closing it any other way (Cancel, swipe, tap outside)
// removes the entry again, so history stays as it was.
import { useCallback, useEffect, useId, useRef } from 'react';

const MARK = 'overlay';
const open = new Set(); // overlays currently holding a history entry

const current = () => window.history.state?.[MARK];

// While an overlay's entry is being removed (history.back() is async), a
// navigation must wait, or the browser would go back past the new page.
let removing = null;
const removeEntry = () => {
  if (!removing) {
    removing = new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('popstate', done);
        removing = null;
        resolve();
      };
      window.addEventListener('popstate', done);
      setTimeout(done, 500); // never hold navigation for long
    });
  }
  window.history.back();
};

/** Runs fn now, or once a closing overlay has left history. */
export const afterOverlayClosed = (fn) => (removing ? removing.then(fn) : fn());

// Landing on an entry whose overlay has gone (e.g. a link inside it was
// followed) skips past it, so one Back press always does something.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const id = current();
    if (id && !open.has(id)) window.history.back();
  });
}

/**
 * useBackToClose(isOpen, onClose) → closeThen(fn)
 * closeThen runs fn (e.g. a navigation) once the overlay's entry is gone,
 * so the next page replaces it rather than stacking on top of it.
 */
const useBackToClose = (isOpen, onClose) => {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pendingBack = useRef(null);
  const afterBack = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (pendingBack.current) {
      // Re-run straight after cleanup (React strict mode): keep the entry.
      clearTimeout(pendingBack.current);
      pendingBack.current = null;
    } else if (current() !== id) {
      window.history.pushState({ ...window.history.state, [MARK]: id }, '');
    }
    open.add(id);
    const onPop = () => {
      if (current() === id) return; // a nested overlay closed
      open.delete(id);
      const then = afterBack.current;
      afterBack.current = null;
      if (then) then();
      else closeRef.current?.();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      open.delete(id);
      pendingBack.current = setTimeout(() => {
        pendingBack.current = null;
        if (current() === id) removeEntry();
      }, 0);
    };
  }, [isOpen, id]);

  return useCallback(
    (fn) => {
      if (current() === id) {
        afterBack.current = () => {
          closeRef.current?.();
          fn?.();
        };
        window.history.back();
      } else {
        closeRef.current?.();
        fn?.();
      }
    },
    [id]
  );
};

export default useBackToClose;
