// src/pages/admin/ComingSoonPage.js — where a link points at a back-office
// page we haven't built yet (e.g. a customer's revenue report). Says what
// the page will show and offers a way back.
import React from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FiArrowLeft, FiClock } from 'react-icons/fi';
import { PageHeader } from '../../components/admin/DataTable';

const FEATURES = {
  'customer-revenue': {
    title: 'Customer revenue report',
    text: 'Everything this customer has spent over time: orders, refunds and net revenue by month, filtered to them.',
  },
  'customer-wishlist': {
    title: 'Customer wishlist',
    text: 'The products this customer has saved, with stock and price changes since they saved them.',
  },
  reviews: {
    title: 'Reviews',
    text: 'Every product review, with filters by product, rating and customer, and tools to reply or hide.',
  },
};

const ComingSoonPage = () => {
  const { feature } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const info = FEATURES[feature] || {
    title: 'Coming soon',
    text: 'This part of the back office is on its way.',
  };
  const who = params.get('name');

  return (
    <Box>
      <PageHeader
        crumbs={[{ label: 'Home', to: '/admin' }, { label: info.title }]}
        title={info.title}
        subtitle={who ? `For ${who}` : undefined}
      />
      <Stack
        alignItems="center"
        spacing={2}
        data-testid="coming-soon"
        sx={{
          mt: 3,
          py: { xs: 6, md: 10 },
          px: 3,
          textAlign: 'center',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            color: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
          }}
        >
          <FiClock />
        </Box>
        <Typography variant="h5" component="h2">
          Coming soon
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
          {info.text}
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            startIcon={<FiArrowLeft />}
            variant="outlined"
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>
          <Button component={RouterLink} to="/admin" variant="contained">
            Store overview
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ComingSoonPage;
