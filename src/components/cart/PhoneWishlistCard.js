// src/components/cart/PhoneWishlistCard.js — a saved product on phones, in
// the same shape as a cart item: photo, name, price and a tick for bulk
// actions; underneath, one main action (Add to bag, or Choose options) and
// Remove. The rest of the details are a tap away on the product page.
import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Checkbox, Stack, Typography } from '@mui/material';
import { FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { formatMoney } from '../../utils/format';

const PhoneWishlistCard = ({
  product: p,
  checked,
  onCheck,
  onAdd,
  onRemove,
  canShop,
  busy,
}) => {
  const link = `/products/${p.id}`;
  const onSale =
    p.specialPrice !== null &&
    p.specialPrice !== undefined &&
    p.specialPrice < p.price;
  return (
    <Box
      component="article"
      data-testid={`wishlist-item-${p.id}`}
      sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 1.5 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '84px minmax(0, 1fr) auto',
          columnGap: 1.5,
          alignItems: 'start',
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
            src={p.images?.[0]}
            alt={p.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
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
            {p.title}
          </Typography>
          {p.brand?.name && (
            <Typography variant="caption" component="div" noWrap>
              {p.brand.name}
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="baseline"
            sx={{ mt: 0.75 }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {formatMoney(onSale ? p.specialPrice : p.price)}
            </Typography>
            {onSale && (
              <Typography
                variant="caption"
                sx={{ textDecoration: 'line-through' }}
              >
                {formatMoney(p.price)}
              </Typography>
            )}
          </Stack>
          {!p.inStock && (
            <Typography variant="caption" color="error.main" component="div">
              Out of stock
            </Typography>
          )}
        </Box>
        <Checkbox
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          inputProps={{ 'aria-label': `Select ${p.title}` }}
          sx={{ p: 0.5, mr: -0.5, mt: -0.5 }}
        />
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        {canShop && (
          <Button
            size="small"
            variant="contained"
            startIcon={<FiShoppingBag />}
            onClick={onAdd}
            disabled={busy || !p.inStock}
            sx={{ flex: 1 }}
          >
            {p.hasOptions ? 'Choose options' : 'Add to bag'}
          </Button>
        )}
        <Button
          size="small"
          startIcon={<FiTrash2 />}
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${p.title}`}
          sx={{ color: 'text.secondary' }}
        >
          Remove
        </Button>
      </Stack>
    </Box>
  );
};

PhoneWishlistCard.propTypes = {
  product: PropTypes.object.isRequired,
  checked: PropTypes.bool,
  onCheck: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  canShop: PropTypes.bool,
  busy: PropTypes.bool,
};

export default PhoneWishlistCard;
