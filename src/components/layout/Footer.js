// src/components/layout/Footer.js
import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import {
  FiArrowRight,
  FiFacebook,
  FiInstagram,
  FiTwitter,
} from 'react-icons/fi';
import { newsletter } from '../../api';
import { useNotify } from '../../notification/NotificationProvider';
import { MESSAGES } from '../../notification/messages';
import payment1 from '../../images/payment1.png';
import payment2 from '../../images/payment2.png';
import payment3 from '../../images/payment3.png';
import payment4 from '../../images/payment4.png';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      ['All products', '/products'],
      ['Wishlist', '/wishlist'],
      ['Cart', '/cart'],
      ['Track your order', '/account/orders'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Support', '/information/support'],
      ['FAQs', '/information/faq'],
      ['Returns', '/account/returns'],
      ['Terms', '/information/terms'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About us', '/information/about'],
      ['Careers', '/information/careers'],
      ['Press', '/information/press'],
      ['Privacy', '/information/privacy'],
    ],
  },
];

const linkSx = {
  color: 'text.secondary',
  textDecoration: 'none',
  '&:hover': { color: 'primary.main' },
};

const Footer = () => {
  const notify = useNotify();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await newsletter.subscribe(email);
      notify.success(MESSAGES.newsletter.subscribed);
      setEmail('');
    } catch (error) {
      notify.error(error, MESSAGES.newsletter.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.neutral',
        borderTop: 1,
        borderColor: 'divider',
        mt: 8,
      }}
    >
      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
        <Grid container spacing={5}>
          <Grid item xs={12} md={5}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.5rem', md: '1.85rem' },
                color: 'text.disabled',
                lineHeight: 1.3,
              }}
            >
              Everyday things,
              <br />
              chosen with care.
            </Typography>
            <Box
              component="form"
              onSubmit={subscribe}
              sx={{ display: 'flex', gap: 1.5, mt: 4, maxWidth: 420 }}
            >
              <InputBase
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                inputProps={{ 'aria-label': 'Your email for the newsletter' }}
                sx={{
                  flex: 1,
                  bgcolor: 'background.neutralDeep',
                  borderRadius: 2,
                  px: 2,
                  height: 42,
                }}
              />
              <Button
                type="submit"
                variant="contained"
                color="inherit"
                disabled={busy}
                endIcon={<FiArrowRight />}
                sx={{
                  bgcolor: 'text.primary',
                  color: '#fff',
                  '&:hover': { bgcolor: '#000' },
                }}
              >
                Subscribe
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Deals and new arrivals, about once a week.
            </Typography>
          </Grid>
          {COLUMNS.map((col) => (
            <Grid item xs={6} sm={4} md={2} key={col.title}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {col.title}
              </Typography>
              <Stack spacing={1.25}>
                {col.links.map(([label, to]) => (
                  <Typography
                    key={label}
                    component={RouterLink}
                    to={to}
                    variant="body2"
                    sx={linkSx}
                  >
                    {label}
                  </Typography>
                ))}
              </Stack>
            </Grid>
          ))}
          <Grid
            item
            xs={12}
            sm={12}
            md={1}
            sx={{ display: 'flex', flexDirection: 'column' }}
          >
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Follow us
            </Typography>
            <Stack direction={{ xs: 'row', md: 'column' }} spacing={1}>
              {[FiFacebook, FiTwitter, FiInstagram].map((Icon, i) => (
                <IconButton
                  key={i}
                  size="small"
                  aria-label={['Facebook', 'X (Twitter)', 'Instagram'][i]}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    width: 36,
                    height: 36,
                  }}
                >
                  <Icon />
                </IconButton>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Container>
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
            sx={{ py: 2.5 }}
          >
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Carlos Shop
            </Typography>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              aria-label="Accepted payment methods"
            >
              {[payment1, payment2, payment3, payment4].map((src, i) => (
                <Box
                  key={i}
                  component="img"
                  src={src}
                  alt=""
                  sx={{ height: 22 }}
                />
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default Footer;
