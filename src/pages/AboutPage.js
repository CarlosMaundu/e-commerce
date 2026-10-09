// src/pages/AboutPage.js — About us: the shop's name and tagline, then the
// story as written in Back office → Site pages.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { legal } from '../api';
import { useStore } from '../context/StoreContext';
import LegalContent from '../components/common/LegalContent';

const AboutPage = () => {
  const shop = useStore();
  const [page, setPage] = useState(null);

  useEffect(() => {
    legal
      .get('about')
      .then(setPage)
      .catch(() => setPage({ title: 'About us', body: '' }));
  }, []);

  return (
    <Box>
      <Box
        sx={{
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          borderBottom: 1,
          borderColor: 'divider',
          py: { xs: 5, md: 8 },
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: '0.16em',
            }}
          >
            {page?.title || 'About us'}
          </Typography>
          <Typography variant="h3" component="h1" sx={{ mt: 1 }}>
            {shop.name}
          </Typography>
          {shop.tagline && (
            <Typography
              color="text.secondary"
              sx={{ mt: 1.5, fontSize: '1.1rem' }}
            >
              {shop.tagline}
            </Typography>
          )}
        </Container>
      </Box>
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {!page ? (
          <Stack spacing={1.5}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="text" />
            ))}
          </Stack>
        ) : (
          <LegalContent
            html={page.body}
            sx={{ mx: 'auto' }}
            data-testid="about-content"
          />
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="center"
          sx={{ mt: 5 }}
        >
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/products"
          >
            Start shopping
          </Button>
          <Button
            variant="outlined"
            size="large"
            component={RouterLink}
            to="/support"
          >
            Contact us
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};

export default AboutPage;
