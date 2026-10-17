// src/pages/MePage.js — the "Me" tab on phones: who you are (or sign in),
// your account pages, then help, the shop's pages, the newsletter and its
// social links, which the desktop footer shows instead.
import React, { useContext, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Container,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { FiChevronRight, FiLogOut } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useNotify } from '../notification/NotificationProvider';
import { MESSAGES } from '../notification/messages';
import { ACCOUNT_NAV } from '../layouts/AccountLayout';
import { COLUMNS, NewsletterForm, SOCIALS } from '../components/layout/Footer';
import { initialsOf } from '../components/common/BrandMark';
import { canShop } from '../auth/permissions';
import ConfirmationDialog from '../components/common/ConfirmationDialog';

const Section = ({ title, children }) => (
  <Box component="section" sx={{ mt: 3 }}>
    <Typography
      variant="overline"
      color="text.secondary"
      component="h2"
      sx={{ px: 0.5 }}
    >
      {title}
    </Typography>
    <Paper variant="outlined" sx={{ mt: 1, overflow: 'hidden' }}>
      {children}
    </Paper>
  </Box>
);

const Row = ({ to, icon, label }) => (
  <ListItemButton component={RouterLink} to={to} sx={{ minHeight: 52 }}>
    {icon && (
      <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
        {icon}
      </ListItemIcon>
    )}
    <ListItemText primary={label} />
    <Box component={FiChevronRight} sx={{ color: 'text.disabled' }} />
  </ListItemButton>
);

const MePage = () => {
  const { user, logout } = useContext(AuthContext);
  const shop = useStore();
  const notify = useNotify();
  const navigate = useNavigate();
  const socials = SOCIALS.filter((x) => shop.social?.[x.key]);

  const [confirmOut, setConfirmOut] = useState(false);
  const signOut = async () => {
    setConfirmOut(false);
    try {
      await logout();
      notify.info(MESSAGES.auth.signedOut);
    } catch (error) {
      notify.error(error);
    }
    navigate('/login');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      {user ? (
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            src={user.avatar || undefined}
            alt=""
            sx={{
              width: 56,
              height: 56,
              fontWeight: 800,
              bgcolor: 'highlight.main',
              color: 'text.primary',
            }}
          >
            {initialsOf(user.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" noWrap>
              {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {user.email}
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h5" component="h1">
            Welcome to {shop.name}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Sign in to see your orders, returns and saved addresses.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              component={RouterLink}
              to="/login"
              state={{ from: '/account' }}
              variant="contained"
              size="large"
              sx={{ flex: 1 }}
            >
              Sign in
            </Button>
            <Button
              component={RouterLink}
              to="/register"
              variant="outlined"
              size="large"
              sx={{ flex: 1 }}
            >
              Create account
            </Button>
          </Stack>
        </Paper>
      )}

      {user &&
        canShop(user) &&
        ACCOUNT_NAV.map((group) => (
          <Section key={group.heading} title={group.heading}>
            <List disablePadding>
              {group.items.map((item) => (
                <Row key={item.to} {...item} />
              ))}
            </List>
          </Section>
        ))}

      {COLUMNS.map((col) => (
        <Section key={col.title} title={col.title}>
          <List disablePadding>
            {col.links.map(([label, to]) => (
              <Row key={label} to={to} label={label} />
            ))}
          </List>
        </Section>
      ))}

      <Box component="section" sx={{ mt: 3 }}>
        <Typography variant="overline" color="text.secondary" component="h2">
          Newsletter
        </Typography>
        <Box sx={{ mt: 1 }}>
          <NewsletterForm />
        </Box>
      </Box>

      {socials.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          {socials.map(({ key, label, Icon }) => (
            <IconButton
              key={key}
              component="a"
              href={shop.social[key]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              sx={{ border: 1, borderColor: 'divider', width: 44, height: 44 }}
            >
              <Icon />
            </IconButton>
          ))}
        </Stack>
      )}

      {user && (
        <Button
          fullWidth
          size="large"
          variant="outlined"
          color="error"
          startIcon={<FiLogOut />}
          onClick={() => setConfirmOut(true)}
          sx={{ mt: 4 }}
        >
          Sign out
        </Button>
      )}
      <ConfirmationDialog
        open={confirmOut}
        title="Sign out?"
        content="You can sign back in any time; your cart and wishlist stay saved."
        confirmText="Sign out"
        onConfirm={signOut}
        onCancel={() => setConfirmOut(false)}
      />
    </Container>
  );
};

export default MePage;
