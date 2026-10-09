// src/pages/FaqPage.js — frequently asked questions, grouped by topic, with
// search and topic filters. Each answer can be linked to (#faq-<id>) and
// opens when visited. "Still need help?" leads to Support.
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Container,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import { faq as faqApi } from '../api';
import LegalContent from '../components/common/LegalContent';

const FaqPage = () => {
  const { hash } = useLocation();
  const [items, setItems] = useState(null);
  const [topic, setTopic] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => hash.replace('#', ''));

  useEffect(() => {
    faqApi
      .list()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // Linked answers open and scroll into view once loaded.
  useEffect(() => {
    if (!items || !hash) return;
    setOpen(hash.replace('#', ''));
    setTimeout(
      () => document.querySelector(hash)?.scrollIntoView({ block: 'center' }),
      100
    );
  }, [items, hash]);

  const topics = useMemo(
    () => [...new Set((items || []).map((i) => i.category))],
    [items]
  );
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items || []).filter(
      (i) =>
        (!topic || i.category === topic) &&
        (!term ||
          `${i.question} ${i.answer.replace(/<[^>]+>/g, ' ')}`
            .toLowerCase()
            .includes(term))
    );
  }, [items, topic, q]);
  const groups = useMemo(
    () =>
      topics
        .map((t) => [t, shown.filter((i) => i.category === t)])
        .filter(([, list]) => list.length),
    [topics, shown]
  );

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1">
          Frequently asked questions
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Quick answers about orders, delivery, payment, returns and your
          account.
        </Typography>
      </Box>
      <TextField
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the FAQs"
        inputProps={{ 'aria-label': 'Search the FAQs' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FiSearch />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2, bgcolor: 'background.paper' }}
      />
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ mb: 3 }}>
        {['', ...topics].map((t) => (
          <Chip
            key={t || 'all'}
            label={t || 'All topics'}
            clickable
            onClick={() => setTopic(t)}
            color={topic === t ? 'primary' : 'default'}
            variant={topic === t ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {!items ? (
        <Stack spacing={1}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={56} />
          ))}
        </Stack>
      ) : groups.length ? (
        <Stack spacing={4}>
          {groups.map(([t, list]) => (
            <Box key={t} component="section" aria-label={t}>
              <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
                {t}
              </Typography>
              {list.map((i) => {
                const id = `faq-${i.faq_id}`;
                return (
                  <Accordion
                    key={i.faq_id}
                    id={id}
                    disableGutters
                    expanded={open === id}
                    onChange={(_, on) => setOpen(on ? id : '')}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: '8px !important',
                      mb: 1,
                      boxShadow: 'none',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<FiChevronDown />}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {i.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <LegalContent
                        html={i.answer}
                        sx={{ fontSize: '0.95rem' }}
                      />
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No questions match “{q.trim()}”.
        </Typography>
      )}

      <Box
        sx={{
          mt: 5,
          p: { xs: 2.5, md: 3 },
          borderRadius: 1,
          bgcolor: 'background.neutral',
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" component="h2">
          Still need help?
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Send us a request and we’ll reply by email.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/support">
          Contact support
        </Button>
      </Box>
    </Container>
  );
};

export default FaqPage;
