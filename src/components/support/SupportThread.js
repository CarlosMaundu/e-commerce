// src/components/support/SupportThread.js — a support request's messages as a
// conversation: your own messages on the right, the other side's on the
// left, each with who and when. Used by customers and staff.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Pill } from '../admin/DataTable';
import { formatDateTime } from '../../utils/format';

export const SUPPORT_STATUS_TONES = {
  open: 'warning',
  waiting: 'info',
  resolved: 'success',
  closed: 'default',
};

export const StatusPill = ({ status, label }) => (
  <Pill label={label} tone={SUPPORT_STATUS_TONES[status] || 'default'} />
);
StatusPill.propTypes = { status: PropTypes.string, label: PropTypes.string };

const SupportThread = ({ messages, me, customerName }) => (
  <Stack spacing={1.5} data-testid="support-thread">
    {messages.map((m, i) => {
      const mine = m.author === me;
      return (
        <Box
          key={i}
          sx={{
            alignSelf: mine ? 'flex-end' : 'flex-start',
            maxWidth: { xs: '92%', md: '78%' },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mb: 0.5, textAlign: mine ? 'right' : 'left' }}
          >
            <strong>
              {m.author === 'customer'
                ? m.name || customerName || 'Customer'
                : m.name}
            </strong>{' '}
            · {formatDateTime(m.created_at)}
          </Typography>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderRadius: mine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              bgcolor: (t) =>
                mine
                  ? alpha(t.palette.primary.main, 0.1)
                  : t.palette.background.neutral,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              lineHeight: 1.6,
            }}
          >
            {m.body}
          </Box>
        </Box>
      );
    })}
  </Stack>
);

SupportThread.propTypes = {
  messages: PropTypes.array.isRequired,
  me: PropTypes.oneOf(['customer', 'staff']).isRequired,
  customerName: PropTypes.string,
};

export default SupportThread;
