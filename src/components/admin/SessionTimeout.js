// src/components/admin/SessionTimeout.js — back-office sessions follow the
// security settings: signed out after the idle timeout, and at the latest
// when the session's maximum length is reached. This warns before either:
// "Are you still there?" with a countdown and "Stay signed in", and a heads-up
// before the session's end time. Activity (mouse, keys, scrolling, touch) is
// shared between open tabs, and keeps the server's idle clock in step.
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import { FiClock } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { auth } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';

const SHARED_KEY = 'admin-last-active';
const WARN_MS = 2 * 60000; // idle warning: two minutes before sign-out
const END_WARN_MS = 5 * 60000; // session end: five minutes before

const readShared = () => {
  try {
    return Number(localStorage.getItem(SHARED_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeShared = (t) => {
  try {
    localStorage.setItem(SHARED_KEY, String(t));
  } catch {
    // private mode etc.: this tab still works on its own
  }
};

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const SessionTimeout = () => {
  const { user, logout } = useContext(AuthContext);
  const notify = useNotify();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [limits, setLimits] = useState(user?.session || null);
  const [now, setNow] = useState(Date.now());
  const [warning, setWarning] = useState(null); // 'idle' | 'end' | null
  const [endDismissed, setEndDismissed] = useState(false);
  const lastActive = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const signingOut = useRef(false);

  // Limits arrive with sign-in; keep the last known ones if a profile
  // refresh replaces the user object without them.
  useEffect(() => {
    if (user?.session) setLimits(user.session);
  }, [user]);

  const idleMs = limits?.idleMinutes ? limits.idleMinutes * 60000 : null;
  const endsAt = limits?.expiresAt
    ? new Date(limits.expiresAt).getTime()
    : null;
  const active = Boolean(user && idleMs);

  // Record activity (ignored while the idle warning is up: that needs a click).
  useEffect(() => {
    if (!active) return undefined;
    let lastWrite = 0;
    const mark = () => {
      if (warning === 'idle') return;
      const t = Date.now();
      lastActive.current = t;
      if (t - lastWrite > 5000) {
        lastWrite = t;
        writeShared(t);
      }
    };
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
    ];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, [active, warning]);

  // Navigating is activity too.
  useEffect(() => {
    lastActive.current = Date.now();
  }, [pathname]);

  const signOut = useCallback(
    async (message) => {
      if (signingOut.current) return;
      signingOut.current = true;
      setWarning(null);
      try {
        await logout();
      } finally {
        notify.info(message);
        navigate('/login', { replace: true, state: { from: pathname } });
      }
    },
    [logout, navigate, notify, pathname]
  );

  const stay = async () => {
    lastActive.current = Date.now();
    writeShared(lastActive.current);
    setWarning(null);
    try {
      const next = await auth.keepAlive();
      if (next) setLimits(next);
      lastPing.current = Date.now();
    } catch {
      // The session already ended on the server; the next request says so.
    }
  };

  // Once a second: work out what's left and warn or sign out.
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const shared = readShared();
      if (shared > lastActive.current && warning !== 'idle') {
        lastActive.current = shared;
      }
      const idleLeft = lastActive.current + idleMs - current;
      const endLeft = endsAt ? endsAt - current : Infinity;
      if (idleLeft <= 0) {
        signOut(
          `You were signed out after ${limits.idleMinutes} minutes without activity.`
        );
      } else if (endLeft <= 0) {
        signOut('Your back-office session has ended. Please sign in again.');
      } else if (idleLeft <= Math.min(WARN_MS, idleMs / 2)) {
        setWarning('idle');
      } else if (endLeft <= END_WARN_MS && !endDismissed) {
        setWarning('end');
      } else if (warning === 'idle') {
        setWarning(null); // another tab kept the session going
      }
      // Keep the server's idle clock in step with activity on this page,
      // even when nothing on it calls the server.
      if (
        lastActive.current > lastPing.current &&
        current - lastPing.current > 60000
      ) {
        lastPing.current = current;
        auth.keepAlive().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active, idleMs, endsAt, endDismissed, warning, limits, signOut]);

  if (!active || !warning) return null;

  const idleLeft = lastActive.current + idleMs - now;
  const endLeft = endsAt ? endsAt - now : 0;
  const warnSpan = Math.min(WARN_MS, idleMs / 2);

  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      aria-labelledby="session-timeout-title"
      data-testid="session-timeout"
    >
      <DialogTitle id="session-timeout-title">
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            mr: 1,
            verticalAlign: '-3px',
            color: 'warning.main',
          }}
        >
          <FiClock />
        </Box>
        {warning === 'idle' ? 'Are you still there?' : 'Your session is ending'}
      </DialogTitle>
      <DialogContent>
        {warning === 'idle' ? (
          <>
            <Typography>
              For security, you’ll be signed out in{' '}
              <strong data-testid="session-countdown">{clock(idleLeft)}</strong>{' '}
              because there’s been no activity for a while.
            </Typography>
            <LinearProgress
              variant="determinate"
              color="warning"
              value={Math.max(0, Math.min(100, (idleLeft / warnSpan) * 100))}
              sx={{ mt: 2, height: 6, borderRadius: 3 }}
            />
          </>
        ) : (
          <Typography>
            Back-office sessions have a maximum length. Yours ends in{' '}
            <strong>{clock(endLeft)}</strong>. Save your work, then sign in
            again to continue.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {warning === 'idle' ? (
          <>
            <Button
              color="inherit"
              onClick={() => signOut('You’ve been signed out.')}
            >
              Sign out now
            </Button>
            <Button variant="contained" onClick={stay} autoFocus>
              Stay signed in
            </Button>
          </>
        ) : (
          <>
            <Button
              color="inherit"
              onClick={() => signOut('Please sign in again to continue.')}
            >
              Sign in again now
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setEndDismissed(true);
                setWarning(null);
              }}
              autoFocus
            >
              OK
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SessionTimeout;
