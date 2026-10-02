// src/components/ImpersonationBanner.js — always visible while a staff member
// is acting as a customer, with a one-click way back.
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { FiEye } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { useNotify } from '../notification/NotificationProvider';

const ImpersonationBanner = () => {
  const { user, stopImpersonation } = useContext(AuthContext);
  const navigate = useNavigate();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  if (!user?.impersonator) return null;

  const stop = async () => {
    setBusy(true);
    const customerId = user.id;
    try {
      const staff = await stopImpersonation();
      if (staff) {
        notify.success(`You’re back as ${staff.name}.`);
        navigate('/admin/users', { state: { focus: customerId } });
      } else {
        notify.info(
          'Your back-office session had ended. Please sign in again.'
        );
        navigate('/login');
      }
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      role="status"
      data-testid="impersonation-banner"
      sx={{
        bgcolor: 'text.primary',
        color: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: (t) => t.zIndex.appBar + 1,
      }}
    >
      <Container maxWidth="xl">
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ py: 1 }}
          flexWrap="wrap"
          useFlexGap
        >
          <FiEye />
          <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}>
            You’re viewing the shop as <strong>{user.name}</strong> (
            {user.email}). Everything you do is recorded under{' '}
            {user.impersonator.name}.
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={stop}
            disabled={busy}
            sx={{ color: '#fff' }}
          >
            {busy ? 'Returning…' : 'Stop viewing as customer'}
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};

export default ImpersonationBanner;
