// src/components/ui/index.js — small building blocks shared by the
// storefront, account and admin screens.
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

const STATUS_COLORS = {
  awaiting_payment: 'warning',
  pending: 'warning',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'default',
  refunded: 'default',
  requested: 'warning',
  approved: 'info',
  received: 'info',
  rejected: 'default',
  paid: 'success',
  failed: 'error',
  active: 'success',
  suspended: 'error',
};

/** Coloured chip for order, payment, return and account statuses. */
export const StatusChip = ({ status, label }) => {
  const theme = useTheme();
  const color = STATUS_COLORS[status] || 'default';
  const palette = color === 'default' ? null : theme.palette[color];
  return (
    <Chip
      size="small"
      label={label || status}
      sx={{
        bgcolor: palette ? palette.light : 'background.neutralDeep',
        color: palette ? palette.main : 'text.secondary',
        fontWeight: 600,
      }}
    />
  );
};
StatusChip.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.string,
};

/** Bordered section with a title row; the main grouping on every page. */
export const SectionCard = ({
  title,
  subtitle,
  action,
  children,
  tinted = false,
  sx,
}) => (
  <Box
    component="section"
    sx={{
      bgcolor: tinted ? 'background.neutral' : 'background.paper',
      border: tinted ? 'none' : 1,
      borderColor: 'divider',
      borderRadius: 1,
      p: { xs: 2.5, md: 3 },
      ...sx,
    }}
  >
    {(title || action) && (
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          {title && (
            <Typography variant="h5" component="h2">
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
    )}
    {children}
  </Box>
);
SectionCard.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  tinted: PropTypes.bool,
  sx: PropTypes.object,
};

/** Tinted tile with an icon, a big number and a label (Aurora "Summary"). */
export const StatTile = ({
  icon,
  value,
  label,
  onClick,
  color = 'primary',
  card = false,
}) => {
  const theme = useTheme();
  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      sx={{
        bgcolor: card ? 'background.paper' : 'background.neutral',
        border: card ? 1 : 0,
        borderColor: 'divider',
        boxShadow: card ? '0 1px 2px rgba(27,33,36,0.04)' : 'none',
        borderRadius: 1,
        p: 2.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color .15s',
        '&:hover': onClick ? { bgcolor: 'background.neutralDeep' } : undefined,
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette[color].main, 0.12),
            color: `${color}.main`,
            fontSize: 20,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h3" component="p">
          {value}
        </Typography>
      </Stack>
      <Typography variant="subtitle1" sx={{ mt: 1.5 }}>
        {label}
      </Typography>
    </Box>
  );
};
StatTile.propTypes = {
  icon: PropTypes.node,
  value: PropTypes.node,
  label: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  color: PropTypes.string,
  card: PropTypes.bool,
};

export const EmptyState = ({ icon, title, children, action }) => (
  <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center' }}>
    {icon && (
      <Box sx={{ fontSize: 40, color: 'text.disabled', lineHeight: 1 }}>
        {icon}
      </Box>
    )}
    <Typography variant="h6">{title}</Typography>
    {children && (
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        {children}
      </Typography>
    )}
    {action}
  </Stack>
);
EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  action: PropTypes.node,
};

/** Label : value rows used in the account profile card. */
export const DetailRows = ({ rows }) => (
  <Box
    component="dl"
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: 'minmax(160px, 220px) 1fr' },
      columnGap: 3,
      rowGap: { xs: 0.5, sm: 1.75 },
      m: 0,
    }}
  >
    {rows.map(([label, value]) => (
      <React.Fragment key={label}>
        <Typography
          component="dt"
          variant="subtitle1"
          sx={{ mt: { xs: 1.5, sm: 0 } }}
        >
          {label}
        </Typography>
        <Typography component="dd" color="text.secondary" sx={{ m: 0 }}>
          {value || '—'}
        </Typography>
      </React.Fragment>
    ))}
  </Box>
);
DetailRows.propTypes = { rows: PropTypes.arrayOf(PropTypes.array).isRequired };
