// src/components/admin/Sla.js — how an order's fulfilment SLA is shown:
// days taken (finished) or elapsed (still open) against its target, with
// a coloured status.
import React from 'react';
import PropTypes from 'prop-types';
import { Stack, Typography } from '@mui/material';
import { Pill } from './DataTable';

export const SLA_STATES = {
  met: ['Met', 'success'],
  breached: ['Breached', 'error'],
  on_track: ['On track', 'info'],
  at_risk: ['At risk', 'warning'],
  not_tracked: ['Not tracked', 'default'],
};

export const slaState = (state) => SLA_STATES[state] || SLA_STATES.not_tracked;

export const daysText = (days) =>
  days === null || days === undefined
    ? '—'
    : `${days.toFixed(1)} day${days === 1 ? '' : 's'}`;

/** "12 min", "5.5 h", "3.2 days". */
export const hoursText = (h) => {
  if (h === null || h === undefined) return '—';
  if (h < 1) {
    const m = Math.round(h * 60);
    return m < 1 ? 'under a minute' : `${m} min`;
  }
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
};

/** Targets as set in the settings: "24 h". */
export const targetText = (h) => `${Number(h)} h`;

/** Orders table cell: "3.2 days taken" / "1.4 days elapsed" and a status. */
export const SlaCell = ({ sla }) => {
  if (!sla) return '—';
  const [label, tone] = slaState(sla.state);
  if (sla.state === 'not_tracked') {
    return (
      <Typography variant="body2" color="text.disabled">
        Not tracked
      </Typography>
    );
  }
  return (
    <Stack spacing={0.5} alignItems="flex-start" data-testid="sla-cell">
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {daysText(sla.days)}{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          {sla.done ? 'taken' : 'elapsed'} · target {sla.targetDays}d
        </Typography>
      </Typography>
      <Pill label={label} tone={tone} />
    </Stack>
  );
};
SlaCell.propTypes = { sla: PropTypes.object };
