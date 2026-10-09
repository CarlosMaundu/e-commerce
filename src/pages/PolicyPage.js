// src/pages/PolicyPage.js — Terms and Conditions, Privacy Policy and the
// Refund & Return Policy, as written in Back office → Legal pages, with links
// between them and an "On this page" list of sections.
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { legal } from '../api';
import LegalContent, {
  withHeadingIds,
} from '../components/common/LegalContent';
import { POLICY_LINKS, policyPath } from '../content/policies';
import { toSafeHtml } from '../utils/richText';
import { formatDate } from '../utils/format';
import NotFoundPage from './NotFoundPage';

const PolicyPage = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    setPage(null);
    setMissing(false);
    legal
      .get(slug)
      .then((p) => live && setPage(p))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [slug]);

  const toc = useMemo(
    () => (page ? withHeadingIds(toSafeHtml(page.body)).toc : []),
    [page]
  );

  if (missing || !POLICY_LINKS.some((p) => p.slug === slug)) {
    return <NotFoundPage />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 5 },
          gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Stack
          spacing={3}
          sx={{ position: { md: 'sticky' }, top: { md: 140 }, minWidth: 0 }}
        >
          <Stack
            component="nav"
            aria-label="Policies"
            spacing={0.5}
            sx={{
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
          {toc.length > 2 && (
            <Box
              component="nav"
              aria-label="On this page"
              sx={{ display: { xs: 'none', md: 'block' }, px: 1.75 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}
              >
                On this page
              </Typography>
              <Stack
                spacing={0.75}
                sx={{ mt: 1, maxHeight: '55vh', overflowY: 'auto' }}
              >
                {toc.map((t) => (
                  <Link
                    key={t.id}
                    href={`#${t.id}`}
                    underline="hover"
                    variant="body2"
                    color="text.secondary"
                  >
                    {t.text}
                  </Link>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>

        <Box
          component="article"
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: { xs: 2.5, md: 5 },
            minWidth: 0,
          }}
        >
          {!page ? (
            <Stack spacing={1.5}>
              <Skeleton variant="text" width="60%" height={48} />
              <Skeleton variant="text" width={180} />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="text" />
              ))}
            </Stack>
          ) : (
            <>
              <Typography variant="h3" component="h1">
                {page.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, mb: 4 }}
              >
                Last updated {formatDate(page.updated_at)}
              </Typography>
              <LegalContent html={page.body} data-testid="policy-content" />
            </>
          )}
        </Box>
      </Box>
    </Container>
  );
};

export default PolicyPage;
