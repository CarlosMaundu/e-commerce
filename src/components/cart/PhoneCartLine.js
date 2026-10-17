// src/components/cart/PhoneCartLine.js — a cart item on phones: photo, name,
// options and price on the left; the "buy now" tick and the quantity on the
// right; gift, wishlist and remove underneath. Unticked items fade a little:
// they stay in the cart but aren't part of this order.
import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { FiGift, FiHeart, FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import { formatMoney, optionText } from '../../utils/format';

const stepSx = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  color: 'text.primary',
};

const PhoneCartLine = ({
  item,
  busy,
  canTick,
  onTick,
  onQuantity,
  onRemove,
  onWishlist,
  onGift,
  giftsOn,
}) => {
  const link = `/products/${item.productId}${
    Object.keys(item.options || {}).length
      ? `?${new URLSearchParams(item.options)}`
      : ''
  }`;
  const onSale =
    item.specialPrice !== null &&
    item.specialPrice !== undefined &&
    item.specialPrice < item.price;
  const details = optionText(item.options);

  return (
    <Box
      data-testid="cart-line"
      sx={{
        bgcolor: 'background.neutral',
        borderRadius: 1,
        p: 1.5,
        opacity: item.selected === false ? 0.6 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '84px minmax(0, 1fr) auto',
          columnGap: 1.5,
          alignItems: 'center',
        }}
      >
        <Box
          component={RouterLink}
          to={link}
          sx={{
            width: 84,
            height: 84,
            borderRadius: '10px',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            display: 'block',
          }}
        >
          <Box
            component="img"
            src={item.image}
            alt={item.title}
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ minWidth: 0, alignSelf: 'stretch' }}>
          <Typography
            component={RouterLink}
            to={link}
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontWeight: 600,
              fontSize: '0.95rem',
              lineHeight: 1.3,
              color: 'text.primary',
              textDecoration: 'none',
            }}
          >
            {item.title}
          </Typography>
          {details && (
            <Typography variant="caption" component="div" noWrap>
              {details}
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="baseline"
            sx={{ mt: 0.75 }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {formatMoney(item.total)}
            </Typography>
            {onSale && (
              <Typography
                variant="caption"
                sx={{ textDecoration: 'line-through' }}
              >
                {formatMoney(item.price * item.quantity)}
              </Typography>
            )}
          </Stack>
          {item.inStock === false && (
            <Chip
              size="small"
              label={`Only ${item.stock} left`}
              sx={{ mt: 0.5, color: 'error.main', bgcolor: 'error.light' }}
            />
          )}
        </Box>
        <Stack
          justifyContent="space-between"
          alignItems="flex-end"
          sx={{ alignSelf: 'stretch' }}
        >
          {canTick ? (
            <Checkbox
              checked={item.selected !== false}
              onChange={(e) => onTick(e.target.checked)}
              disabled={busy}
              inputProps={{ 'aria-label': `Buy ${item.title} now` }}
              sx={{ p: 0.5, mr: -0.5, mt: -0.5 }}
            />
          ) : (
            <span />
          )}
          <Stack
            direction="row"
            alignItems="center"
            sx={{ bgcolor: 'background.paper', borderRadius: '10px' }}
          >
            <IconButton
              aria-label={`Decrease quantity of ${item.title}`}
              disabled={busy || item.quantity <= 1}
              onClick={() => onQuantity(item.quantity - 1)}
              sx={stepSx}
            >
              <FiMinus size={14} />
            </IconButton>
            <Typography
              aria-label="Quantity"
              sx={{ minWidth: 22, textAlign: 'center', fontWeight: 600 }}
            >
              {item.quantity}
            </Typography>
            <IconButton
              aria-label={`Increase quantity of ${item.title}`}
              disabled={busy || item.quantity >= 99}
              onClick={() => onQuantity(item.quantity + 1)}
              sx={stepSx}
            >
              <FiPlus size={14} />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ mt: 1, '& .MuiButton-root': { color: 'text.secondary' } }}
      >
        {giftsOn && (
          <Button
            size="small"
            startIcon={<FiGift />}
            onClick={onGift}
            disabled={busy}
            aria-label={`Gift options for ${item.title}`}
            sx={item.gift ? { color: 'primary.main !important' } : undefined}
          >
            {item.gift ? `Gift to ${item.gift.to}` : 'Gift'}
          </Button>
        )}
        {onWishlist && (
          <Button
            size="small"
            startIcon={<FiHeart />}
            onClick={onWishlist}
            disabled={busy}
            aria-label={`Move ${item.title} to wishlist`}
          >
            Save
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<FiTrash2 />}
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${item.title}`}
        >
          Remove
        </Button>
      </Stack>
    </Box>
  );
};

PhoneCartLine.propTypes = {
  item: PropTypes.object.isRequired,
  busy: PropTypes.bool,
  canTick: PropTypes.bool,
  onTick: PropTypes.func.isRequired,
  onQuantity: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onWishlist: PropTypes.func,
  onGift: PropTypes.func,
  giftsOn: PropTypes.bool,
};

export default PhoneCartLine;
