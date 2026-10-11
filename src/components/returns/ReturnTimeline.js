// src/components/returns/ReturnTimeline.js — a return's steps, newest
// first. Staff also see who did each step and staff-only notes.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import { Pill } from '../admin/DataTable';
import { formatDateTime } from '../../utils/format';

const EVENT_TONES = {
  requested: 'warning',
  approved: 'info',
  received: 'primary',
  refund_requested: 'warning',
  refund_rejected: 'error',
  refunded: 'success',
  rejected: 'default',
  note: 'default',
};

/** A return's steps, newest first. */
const ReturnTimeline = ({ events, staff }) => (
  <Stack
    spacing={2}
    component="ol"
    sx={{ listStyle: 'none', p: 0, m: 0 }}
    data-testid="return-timeline"
  >
    {[...events].reverse().map((e, i) => (
      <Stack key={i} component="li" direction="row" spacing={2}>
        <Box sx={{ pt: 0.25, minWidth: 0 }}>
          <Pill label={e.name} tone={EVENT_TONES[e.status] || 'default'} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" component="div">
            {formatDateTime(e.date)}
            {staff && e.by ? ` · ${e.by}` : ''}
            {staff && e.internal ? ' · staff only' : ''}
          </Typography>
          {e.note && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {e.note}
            </Typography>
          )}
        </Box>
      </Stack>
    ))}
  </Stack>
);
ReturnTimeline.propTypes = {
  events: PropTypes.array.isRequired,
  staff: PropTypes.bool,
};

export default ReturnTimeline;
