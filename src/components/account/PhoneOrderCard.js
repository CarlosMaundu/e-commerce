// src/components/account/PhoneOrderCard.js — an order in "My orders" on
// phones: the whole card opens it (number, status, date, photos, total);
// Track, Invoice and Buy again sit in its ⋮ menu instead of four buttons.
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { FiMoreVertical } from 'react-icons/fi';
import { StatusChip } from '../ui';
import { formatDate, formatMoney } from '../../utils/format';

const PhoneOrderCard = ({ order: o, note, onReorder, reordering }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const link = `/account/orders/${o.id}`;
  const items = o.preview || [];
  const trackable = !['cancelled', 'refunded'].includes(o.status);
  const close = () => setAnchor(null);

  return (
    <Box
      component="article"
      data-testid={`order-${o.id}`}
      onClick={() => navigate(link)}
      sx={{
        bgcolor: 'background.neutral',
        borderRadius: 1,
        p: 2,
        cursor: 'pointer',
        '&:active': { bgcolor: 'background.neutralDeep' },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component={RouterLink}
            to={link}
            onClick={(e) => e.stopPropagation()}
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              textDecoration: 'none',
            }}
          >
            Order {o.number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(o.placedAt)} · {o.itemCount} item
            {o.itemCount === 1 ? '' : 's'}
          </Typography>
        </Box>
        <StatusChip status={o.status} label={o.statusName} />
        <IconButton
          size="small"
          aria-label={`More for order ${o.number}`}
          onClick={(e) => {
            e.stopPropagation();
            setAnchor(e.currentTarget);
          }}
          sx={{ mt: -0.5, mr: -1 }}
        >
          <FiMoreVertical />
        </IconButton>
      </Stack>

      {items.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.5, overflowX: 'auto', scrollbarWidth: 'none' }}
        >
          {items.slice(0, 6).map((item, i) => (
            <Box
              key={i}
              component="img"
              src={item.image}
              alt={item.name}
              sx={{
                width: 56,
                height: 56,
                flexShrink: 0,
                objectFit: 'contain',
                borderRadius: '8px',
                bgcolor: 'background.paper',
              }}
            />
          ))}
        </Stack>
      )}

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        spacing={1}
        sx={{ mt: 1.5 }}
      >
        <Typography variant="body2" color="text.secondary" noWrap>
          {note ? `${note[0]} ${note[1]}` : ''}
        </Typography>
        <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          {formatMoney(o.total, o.currency)}
        </Typography>
      </Stack>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {trackable && (
          <MenuItem
            component={RouterLink}
            to={`/account/track?order=${o.id}`}
            onClick={close}
          >
            Track
          </MenuItem>
        )}
        <MenuItem
          component={RouterLink}
          to={`/account/invoices/${o.id}`}
          onClick={close}
        >
          Invoice
        </MenuItem>
        <MenuItem
          disabled={reordering}
          onClick={() => {
            close();
            onReorder(o.id);
          }}
        >
          Buy again
        </MenuItem>
      </Menu>
    </Box>
  );
};

PhoneOrderCard.propTypes = {
  order: PropTypes.object.isRequired,
  note: PropTypes.array,
  onReorder: PropTypes.func.isRequired,
  reordering: PropTypes.bool,
};

export default PhoneOrderCard;
