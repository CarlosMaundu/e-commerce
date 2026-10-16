// src/navigation.js — how moving between pages feels on a phone:
//   - Back and Forward return to where you were on the page; a new page
//     starts at the top; changing filters on the same page doesn't jump.
//   - Phones slide pages in (forward) and out (back) with the browser's
//     View Transitions; switching bottom-menu tabs cross-fades.
// Desktop and reduced-motion users get instant page changes, as before.
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { afterOverlayClosed } from './hooks/useBackToClose';

const PHONE = '(max-width: 899.95px)';
const TABS = [
  '/',
  '/products',
  '/wishlist',
  '/account/wishlist',
  '/cart',
  '/me',
];

const matches = (query) =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(query).matches;

/** Slide transitions only where they help: phones, motion allowed. */
export const wantsMotion = () =>
  typeof document !== 'undefined' &&
  typeof document.startViewTransition === 'function' &&
  matches(PHONE) &&
  !matches('(prefers-reduced-motion: reduce)');

/**
 * Every navigation (links, navigate(), Back) uses a view transition on
 * phones, and the page knows which way to slide: html[data-nav] is
 * "forward", "back" or "tab" while it runs (see index.css).
 */
export const withPageTransitions = (router) => {
  const navigate = router.navigate;
  router.navigate = (to, opts) =>
    afterOverlayClosed(() =>
      typeof to === 'number'
        ? navigate(to, opts)
        : navigate(to, {
            ...opts,
            viewTransition: opts?.viewTransition ?? wantsMotion(),
          })
    );
  let from = router.state.location.pathname;
  router.subscribe((state) => {
    const to = state.location.pathname;
    if (state.navigation.state !== 'idle' || to === from) return;
    document.documentElement.dataset.nav =
      state.historyAction === 'POP'
        ? 'back'
        : TABS.includes(from) && TABS.includes(to)
          ? 'tab'
          : 'forward';
    from = to;
  });
  return router;
};

const positions = new Map(); // location key → scrollY

// Straight there: the global stylesheet turns on smooth scrolling, which
// would make Back glide down the whole list.
const jump = (top) => window.scrollTo({ top, left: 0, behavior: 'instant' });

/** Scrolls to the top for new pages and back to the spot on Back/Forward. */
export const ScrollMemory = () => {
  const location = useLocation();
  const type = useNavigationType();
  const keyRef = useRef(location.key);
  const pathRef = useRef(location.pathname);

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        positions.set(keyRef.current, window.scrollY)
      );
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
    };
  }, []);

  useLayoutEffect(() => {
    const samePage = pathRef.current === location.pathname;
    keyRef.current = location.key;
    pathRef.current = location.pathname;
    const saved = positions.get(location.key);
    if (type === 'POP' && saved !== undefined) {
      // The page may still be loading: keep trying until it is tall enough,
      // for up to two seconds, unless the shopper starts scrolling.
      let stop = false;
      const cancel = () => {
        stop = true;
      };
      window.addEventListener('touchstart', cancel, { passive: true });
      window.addEventListener('wheel', cancel, { passive: true });
      const started = performance.now();
      const attempt = () => {
        if (stop) return;
        const room = document.documentElement.scrollHeight - window.innerHeight;
        jump(Math.min(saved, Math.max(room, 0)));
        if (room < saved && performance.now() - started < 2000) {
          requestAnimationFrame(attempt);
        }
      };
      attempt();
      return () => {
        cancel();
        window.removeEventListener('touchstart', cancel);
        window.removeEventListener('wheel', cancel);
      };
    }
    if (!samePage && !location.hash) jump(0);
    return undefined;
  }, [location.key, location.pathname, location.hash, type]);

  return null;
};
