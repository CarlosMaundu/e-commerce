// src/serviceWorkerRegistration.js — registers the service worker in
// production builds (src/service-worker.js) and tells the page when a new
// version of the shop is waiting, so it can offer a reload.
const listeners = new Set();
let waiting = null;

/** onUpdate(fn): fn(apply) runs when a new version is ready; apply reloads. */
export const onUpdate = (fn) => {
  listeners.add(fn);
  if (waiting) fn(applyUpdate);
  return () => listeners.delete(fn);
};

const applyUpdate = () => {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () =>
    window.location.reload()
  );
  waiting.postMessage({ type: 'SKIP_WAITING' });
};

const announce = (worker) => {
  waiting = worker;
  listeners.forEach((fn) => fn(applyUpdate));
};

export const register = () => {
  if (
    process.env.NODE_ENV !== 'production' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js`)
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          announce(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            // A first install needs no notice; a replacement does.
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              announce(worker);
            }
          });
        });
        // Long-open tabs look for a new version every hour.
        setInterval(() => registration.update().catch(() => {}), 3600 * 1000);
      })
      .catch(() => {
        // No offline support this time; the shop still works online.
      });
  });
};
