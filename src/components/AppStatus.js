// src/components/AppStatus.js — two app-wide notices:
//   - "You're offline": saved pages still open, but ordering needs a
//     connection. Goes away by itself when the connection is back.
//   - "A new version of the shop is ready" with Reload, after a deploy
//     (from the service worker), so nobody keeps using an old version.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Slide, Snackbar } from '@mui/material';
import { FiWifiOff } from 'react-icons/fi';
import { onUpdate } from '../serviceWorkerRegistration';

const AppStatus = () => {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  const [apply, setApply] = useState(null);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const stop = onUpdate((fn) => setApply(() => fn));
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      stop();
    };
  }, []);

  return (
    <>
      <Slide direction="down" in={!online} mountOnEnter unmountOnExit>
        <Alert
          role="status"
          severity="warning"
          icon={<FiWifiOff />}
          data-testid="offline-banner"
          sx={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top) + 8px)',
            left: 12,
            right: 12,
            mx: 'auto',
            maxWidth: 560,
            zIndex: (t) => t.zIndex.snackbar,
            boxShadow: '0 12px 32px rgba(27,33,36,0.14)',
          }}
        >
          You’re offline. Saved pages still open; ordering needs a connection.
        </Alert>
      </Slide>
      <Snackbar
        open={Boolean(apply)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message="A new version of the shop is ready."
        action={
          <Button color="inherit" size="small" onClick={() => apply?.()}>
            Reload
          </Button>
        }
      />
    </>
  );
};

export default AppStatus;
