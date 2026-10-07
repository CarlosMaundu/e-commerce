// src/components/account/OrderTracker.js — where an order is: Placed →
// Processing → Shipped → Delivered, with the date each step happened (from
// the order's history). Cancelled and refunded orders say so instead.
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiCheck,
  FiHome,
  FiPackage,
  FiShoppingBag,
  FiTruck,
} from 'react-icons/fi';
import { formatDateTime } from '../../utils/format';

const STEPS = [
  {
    key: 'placed',
    label: 'Order placed',
    icon: <FiShoppingBag />,
    statuses: ['awaiting_payment', 'pending'],
  },
  {
    key: 'processing',
    label: 'Processing',
    icon: <FiPackage />,
    statuses: ['processing'],
  },
  {
    key: 'shipped',
    label: 'Shipped',
    icon: <FiTruck />,
    statuses: ['shipped'],
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: <FiHome />,
    statuses: ['delivered'],
  },
];

export const stepIndex = (status) =>
  Math.max(
    0,
    STEPS.findIndex((s) => s.statuses.includes(status))
  );

/** 0–100, for compact progress bars. */
export const progressOf = (status) =>
  ['cancelled', 'refunded'].includes(status)
    ? 0
    : Math.round((stepIndex(status) / (STEPS.length - 1)) * 100);

const OrderTracker = ({ order, compact }) => {
  const theme = useTheme();
  if (['cancelled', 'refunded'].includes(order.status)) {
    return (
      <Alert severity={order.status === 'refunded' ? 'info' : 'warning'}>
        This order was {order.status === 'refunded' ? 'refunded' : 'cancelled'}
        {order.history?.length
          ? ` on ${formatDateTime(order.history[order.history.length - 1].date)}`
          : ''}
        .
      </Alert>
    );
  }
  const current = stepIndex(order.status);
  const dateOf = (step) => {
    if (step.key === 'placed') return order.placedAt;
    return (order.history || []).find((h) => step.statuses.includes(h.status))
      ?.date;
  };
  const main = theme.palette.primary.main;

  return (
    <Box
      role="list"
      aria-label="Order progress"
      data-testid="order-tracker"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${STEPS.length}, 1fr)` },
        gap: { xs: 1.5, sm: 0 },
      }}
    >
      {STEPS.map((step, i) => {
        const done = i <= current;
        const date = done ? dateOf(step) : null;
        return (
          <Stack
            key={step.key}
            role="listitem"
            aria-current={i === current ? 'step' : undefined}
            direction={{ xs: 'row', sm: 'column' }}
            alignItems={{ xs: 'center', sm: 'flex-start' }}
            spacing={1.25}
            sx={{ position: 'relative' }}
          >
            <Stack
              direction="row"
              alignItems="center"
              sx={{ width: { sm: '100%' } }}
            >
              <Box
                sx={{
                  width: compact ? 32 : 40,
                  height: compact ? 32 : 40,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  fontSize: compact ? 15 : 18,
                  color: done ? '#fff' : 'text.disabled',
                  bgcolor: done ? 'primary.main' : 'background.neutralDeep',
                  boxShadow:
                    i === current ? `0 0 0 5px ${alpha(main, 0.16)}` : 'none',
                }}
              >
                {done && i < current ? <FiCheck /> : step.icon}
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  aria-hidden
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    flex: 1,
                    height: 3,
                    mx: 1,
                    borderRadius: 999,
                    bgcolor:
                      i < current ? 'primary.main' : 'background.neutralDeep',
                  }}
                />
              )}
            </Stack>
            <Box>
              <Typography
                variant="subtitle2"
                color={done ? 'text.primary' : 'text.secondary'}
              >
                {step.label}
              </Typography>
              {!compact && (
                <Typography variant="caption" component="div">
                  {date
                    ? formatDateTime(date)
                    : i === current + 1
                      ? 'Next'
                      : ' '}
                </Typography>
              )}
            </Box>
          </Stack>
        );
      })}
    </Box>
  );
};

OrderTracker.propTypes = {
  order: PropTypes.object.isRequired,
  compact: PropTypes.bool,
};

export default OrderTracker;
