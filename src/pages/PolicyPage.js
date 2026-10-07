// src/pages/PolicyPage.js — Terms and conditions, Privacy policy and the
// Refund & Return Policy, with links between them.
import React from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Container, Link, Stack, Typography } from '@mui/material';
import { useStore } from '../context/StoreContext';
import {
  getPolicy,
  POLICY_LINKS,
  POLICY_UPDATED,
  policyPath,
} from '../content/policies';
import { formatDate } from '../utils/format';
import NotFoundPage from './NotFoundPage';

const PolicyPage = () => {
  const { slug } = useParams();
  const shop = useStore();
  const policy = getPolicy(slug, shop);
  if (!policy) return <NotFoundPage />;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 5 },
          gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Stack
          component="nav"
          aria-label="Policies"
          spacing={0.5}
          sx={{
            position: { md: 'sticky' },
            top: { md: 140 },
            flexDirection: { xs: 'row', md: 'column' },
            gap: { xs: 1, md: 0 },
            overflowX: { xs: 'auto', md: 'visible' },
          }}
        >
          {POLICY_LINKS.map((p) => (
            <Box
              key={p.slug}
              component={RouterLink}
              to={policyPath(p.slug)}
              aria-current={p.slug === slug ? 'page' : undefined}
              sx={{
                px: 1.75,
                py: 1,
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                fontWeight: p.slug === slug ? 700 : 500,
                color: p.slug === slug ? 'primary.main' : 'text.secondary',
                bgcolor: p.slug === slug ? 'primary.light' : 'transparent',
                '&:hover': { color: 'text.primary' },
              }}
            >
              {p.label}
            </Box>
          ))}
        </Stack>

        <Box
          component="article"
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: { xs: 2.5, md: 5 },
          }}
        >
          <Typography variant="h3" component="h1">
            {policy.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Last updated {formatDate(POLICY_UPDATED)}
          </Typography>
          <Typography sx={{ mt: 3 }}>{policy.intro}</Typography>
          {policy.sections.map((s, i) => (
            <Box component="section" key={s.heading} sx={{ mt: 4 }}>
              <Typography variant="h5" component="h2" sx={{ mb: 1.25 }}>
                {i + 1}. {s.heading}
              </Typography>
              {(s.body || []).map((p) => (
                <Typography key={p.slice(0, 40)} paragraph>
                  {p}
                </Typography>
              ))}
              {s.list && (
                <Box component="ul" sx={{ pl: 3, my: 0 }}>
                  {s.list.map((item) => (
                    <Typography
                      component="li"
                      key={item.slice(0, 40)}
                      sx={{ mb: 0.75 }}
                    >
                      {item}
                    </Typography>
                  ))}
                </Box>
              )}
              {s.link && (
                <Link
                  component={RouterLink}
                  to={s.link.to || policyPath(s.link.slug)}
                  sx={{ fontWeight: 600, display: 'inline-block', mt: 1 }}
                >
                  {s.link.label}
                </Link>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Container>
  );
};

export default PolicyPage;
