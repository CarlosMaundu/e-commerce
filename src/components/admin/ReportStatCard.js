// src/components/admin/ReportStatCard.js — the stat card used across
// Reports (and SLA performance), and how report values are written.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FiArrowDownRight, FiArrowUpRight } from 'react-icons/fi';
import { formatDate, formatMoney } from '../../utils/format';

/** A value in its report format. */
export const formatValue = (v, format) => {
  if (v === null || v === undefined || v === '') return '—';
  switch (format) {
    case 'money':
      return formatMoney(v);
    case 'percent':
      return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    case 'number':
      return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
    case 'days':
      return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
    case 'hours':
      return Number(v) >= 48
        ? `${(Number(v) / 24).toFixed(1)} days`
        : `${Number(v).toFixed(1)} h`;
    case 'date':
      return formatDate(v);
    default:
      return String(v);
  }
};

/**
 * A report's stat card: label, value, change against the comparison (green
 * when better, red when worse) and a hint. With onClick it filters, and
 * `active` marks the chosen one.
 */
const ReportStatCard = ({ card, onClick, active }) => {
  const theme = useTheme();
  // Nothing in either period: a "0%" change says nothing, so it's left out.
  const nothing = !Number(card.value) && !Number(card.compare);
  const has = card.change !== null && card.change !== undefined && !nothing;
  const up = has && card.change > 0;
  const good = has && card.change !== 0 && (card.inverse ? !up : up);
  const tone =
    !has || card.change === 0
      ? 'text.secondary'
      : good
        ? 'success.main'
        : 'error.main';
  return (
    <Box
      data-testid={`report-card-${card.key}`}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': Boolean(active),
            onClick,
            onKeyDown: (e) => e.key === 'Enter' && onClick(),
          }
        : {})}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s',
        ...(onClick && { '&:hover': { borderColor: 'primary.light' } }),
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: active ? 'primary.main' : 'divider',
        boxShadow: active ? `0 0 0 1px ${theme.palette.primary.main}` : 'none',
        bgcolor: 'background.paper',
        minWidth: 0,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: 600 }}
      >
        {card.label}
      </Typography>
      <Typography
        sx={{
          color: card.valueTone ? `${card.valueTone}.main` : undefined,
          fontWeight: 800,
          fontSize: '1.5rem',
          mt: 0.75,
          lineHeight: 1.2,
        }}
        noWrap
      >
        {formatValue(card.value, card.format)}
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="flex-start"
        sx={{ mt: 0.75, minHeight: 20 }}
      >
        {has && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              color: tone,
              fontWeight: 700,
              fontSize: '0.8rem',
              bgcolor: alpha(theme.palette.text.primary, 0.04),
              borderRadius: '6px',
              px: 0.75,
              flexShrink: 0,
            }}
          >
            {card.change > 0 ? (
              <FiArrowUpRight />
            ) : card.change < 0 ? (
              <FiArrowDownRight />
            ) : null}
            {card.format === 'percent'
              ? `${card.change > 0 ? '+' : ''}${card.change} pts`
              : `${card.change > 0 ? '+' : ''}${card.change}%`}
          </Box>
        )}
        {/* Up to two lines, so the hint is read in full. */}
        <Typography
          variant="caption"
          color="text.secondary"
          title={card.hint}
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {card.hint || (has ? 'vs comparison' : '')}
        </Typography>
      </Stack>
    </Box>
  );
};

ReportStatCard.propTypes = {
  card: PropTypes.object.isRequired,
  onClick: PropTypes.func,
  active: PropTypes.bool,
};

export default ReportStatCard;
