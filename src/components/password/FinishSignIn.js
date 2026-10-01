// src/components/password/FinishSignIn.js
//
// Landing page for email-link sign-in. Web email links open this app's own
// URL directly, so this flow does not rely on Firebase Dynamic Links.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../../firebase';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';
import { friendlyError } from '../../utils/friendlyError';

const STORAGE_KEY = 'emailForSignIn';

const FinishSignIn = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  // 'checking' | 'needEmail' | 'signingIn' | 'invalid' | 'error'
  const [stage, setStage] = useState('checking');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const complete = useCallback(
    async (emailToUse) => {
      setStage('signingIn');
      try {
        await signInWithEmailLink(auth, emailToUse, window.location.href);
        window.localStorage.removeItem(STORAGE_KEY);
        notify.success(MESSAGES.auth.signInLinkCompleted);
        navigate('/', { replace: true });
      } catch (err) {
        setErrorMessage(friendlyError(err, MESSAGES.auth.signInFailed));
        setStage('error');
      }
    },
    [navigate, notify]
  );

  useEffect(() => {
    if (!auth || !isSignInWithEmailLink(auth, window.location.href)) {
      setStage('invalid');
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      complete(saved);
    } else {
      // Link opened on a different device/browser: ask which email it was for.
      setStage('needEmail');
    }
  }, [complete]);

  const shell = (children) => (
    <Box display="flex" justifyContent="center" mt={8} px={2}>
      <Paper sx={{ p: 4, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {children}
      </Paper>
    </Box>
  );

  if (stage === 'checking' || stage === 'signingIn') {
    return shell(
      <>
        <CircularProgress />
        <Typography variant="h6" mt={2}>
          Signing you in…
        </Typography>
      </>
    );
  }

  if (stage === 'needEmail') {
    return shell(
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) complete(email.trim());
        }}
      >
        <Typography variant="h5" gutterBottom>
          Confirm your email
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {MESSAGES.auth.signInLinkConfirmEmail}
        </Typography>
        <TextField
          label="Email Address"
          type="email"
          fullWidth
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
          Continue
        </Button>
      </Box>
    );
  }

  return shell(
    <>
      <Typography variant="h5" gutterBottom>
        {stage === 'invalid'
          ? 'This link isn’t valid'
          : 'We couldn’t sign you in'}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {stage === 'invalid'
          ? 'The sign-in link is invalid or has already been used. Please request a new one.'
          : errorMessage}
      </Typography>
      <Button variant="contained" onClick={() => navigate('/login')}>
        Back to sign in
      </Button>
    </>
  );
};

export default FinishSignIn;
