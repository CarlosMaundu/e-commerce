// src/pages/VerifyEmailPage.js — confirming an email address: either the
// link from the email (?token=…) or "check your inbox" after signing up or a
// refused sign-in (?sent=email), with a button to send another link.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { FiCheckCircle, FiMail } from 'react-icons/fi';
import { auth } from '../api';
import { useNotify } from '../notification/NotificationProvider';

const Panel = ({ icon, title, children }) => (
  <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
    <Stack
      spacing={2}
      alignItems="center"
      textAlign="center"
      sx={{
        p: { xs: 3, sm: 5 },
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ fontSize: 40, color: 'primary.main', display: 'flex' }}>
        {icon}
      </Box>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      {children}
    </Stack>
  </Container>
);

const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const notify = useNotify();
  const token = params.get('token');
  const sent = params.get('sent');
  const [state, setState] = useState(token ? 'checking' : 'sent');
  const [email, setEmail] = useState(sent || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    auth
      .verifyEmail(token)
      .then((d) => {
        setEmail(d.email);
        setState('verified');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const resend = async () => {
    setBusy(true);
    try {
      await auth.resendVerification(email);
      notify.success('We’ve sent you a new link.');
    } catch (error) {
      notify.error(error, 'We couldn’t send the link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'checking') {
    return (
      <Panel icon={<CircularProgress size={36} />} title="Confirming…">
        <Typography color="text.secondary">One moment.</Typography>
      </Panel>
    );
  }
  if (state === 'verified') {
    return (
      <Panel icon={<FiCheckCircle />} title="Email confirmed">
        <Typography color="text.secondary">
          Thanks, {email} is confirmed. You can sign in now.
        </Typography>
        <Button
          variant="contained"
          component={RouterLink}
          to="/login"
          size="large"
        >
          Sign in
        </Button>
      </Panel>
    );
  }
  return (
    <Panel icon={<FiMail />} title="Confirm your email">
      {state === 'invalid' && (
        <Alert severity="warning" sx={{ width: '100%', textAlign: 'left' }}>
          This link is invalid or has expired. Send yourself a new one below.
        </Alert>
      )}
      <Typography color="text.secondary">
        {email
          ? `We’ve sent a confirmation link to ${email}. Open it to finish setting up your account, then sign in.`
          : 'Open the link we emailed you to confirm your address.'}
      </Typography>
      {email && (
        <Button variant="outlined" onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Send another link'}
        </Button>
      )}
      <Button component={RouterLink} to="/login">
        Back to sign in
      </Button>
    </Panel>
  );
};

export default VerifyEmailPage;
