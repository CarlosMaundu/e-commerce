// src/components/InstallPrompt.js — "Add the shop to your home screen",
// offered at a good moment (after placing an order, or when tracking one),
// never on a first visit. Android/Chrome installs with one tap; iPhone shows
// the two Safari steps. "Not now" waits 30 days before asking again.
//
//   offerInstall()  — call after a high-value moment; shows the sheet if the
//                     shop can be installed and the shopper hasn't declined.
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { FiPlusSquare, FiShare } from 'react-icons/fi';
import ResponsiveSheet from './common/ResponsiveSheet';
import { useStore } from '../context/StoreContext';

const SNOOZE_KEY = 'install-snoozed-until';
const SNOOZE_DAYS = 30;
const EVENT = 'shop:offer-install';

// Chrome/Android hand us the install prompt once; keep it for later.
let deferred = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
  });
}

const installed = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  !/crios|fxios/i.test(window.navigator.userAgent); // Safari adds apps

const snoozed = () => {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
};

const snooze = () => {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      String(Date.now() + SNOOZE_DAYS * 24 * 3600 * 1000)
    );
  } catch {
    // storage unavailable: we'll just ask again next time
  }
};

/** Offers the app if it can be installed here and hasn't been declined. */
export const offerInstall = () => {
  if (typeof window === 'undefined' || installed() || snoozed()) return;
  if (!deferred && !isIos()) return;
  window.dispatchEvent(new Event(EVENT));
};

const InstallPrompt = () => {
  const shop = useStore();
  const [open, setOpen] = useState(false);
  const ios = typeof window !== 'undefined' && isIos();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  const later = () => {
    snooze();
    setOpen(false);
  };

  const install = async () => {
    const prompt = deferred;
    setOpen(false);
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({}));
    deferred = null;
    if (outcome !== 'accepted') snooze();
  };

  return (
    <ResponsiveSheet
      open={open}
      onClose={later}
      maxWidth="xs"
      fullWidth
      aria-labelledby="install-title"
      data-testid="install-prompt"
    >
      <DialogTitle id="install-title">
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            component="img"
            src="/api/rest/app-icon/96.png"
            alt=""
            sx={{ width: 56, height: 56, borderRadius: '14px', flexShrink: 0 }}
          />
          <Box>
            Get the {shop.name} app
            <Typography variant="body2" color="text.secondary">
              Opens from your home screen, quick to check your orders.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      {ios && (
        <DialogContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component={FiShare}
                sx={{ fontSize: 22, color: 'primary.main' }}
              />
              <Typography>
                Tap <strong>Share</strong> in Safari’s toolbar.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component={FiPlusSquare}
                sx={{ fontSize: 22, color: 'primary.main' }}
              />
              <Typography>
                Choose <strong>Add to Home Screen</strong>.
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={later}>
          Not now
        </Button>
        {ios ? (
          <Button variant="contained" onClick={() => setOpen(false)}>
            Got it
          </Button>
        ) : (
          <Button variant="contained" onClick={install}>
            Install
          </Button>
        )}
      </DialogActions>
    </ResponsiveSheet>
  );
};

export default InstallPrompt;
