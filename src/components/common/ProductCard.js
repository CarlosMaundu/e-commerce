// src/components/common/ProductCard.js — Aurora-style product tile. The photo
// sits straight on the card; the card's tinted background appears on hover.
import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Rating,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { FiHeart, FiShoppingCart } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { canShop } from '../../auth/permissions';
import { addToCart } from '../../redux/cartSlice';
import {
  addToWishlist,
  isInWishlist,
  removeFromWishlist,
} from '../../redux/wishlistSlice';
import { useNotify } from '../../notification/NotificationProvider';
import { formatMoney } from '../../utils/format';
import { isColorAttribute, swatchFor } from '../../utils/colors';

export const Swatches = ({ values, max = 4, size = 12 }) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    {values.slice(0, max).map((v) => (
      <Tooltip key={v} title={v}>
        <Box
          aria-label={v}
          sx={{
            width: size,
            height: size,
            borderRadius: '3px',
            background: swatchFor(v),
            border: 1,
            borderColor: 'divider',
          }}
        />
      </Tooltip>
    ))}
    {values.length > max && (
      <Typography variant="caption">+{values.length - max}</Typography>
    )}
  </Stack>
);

Swatches.propTypes = {
  values: PropTypes.arrayOf(PropTypes.string).isRequired,
  max: PropTypes.number,
  size: PropTypes.number,
};

const ProductCard = ({ product, compact = false }) => {
  const { user } = useContext(AuthContext);
  const shopper = canShop(user);
  const dispatch = useDispatch();
  const notify = useNotify();
  const saved = useSelector((s) => isInWishlist(s, product.id));
  const colors =
    product.attributes?.find((a) => isColorAttribute(a.name))?.values || [];
  const onSale =
    product.specialPrice !== null && product.specialPrice !== undefined;
  const price = onSale ? product.specialPrice : product.price;
  const priceVaries = product.minPrice < product.maxPrice;

  const add = async (e) => {
    e.preventDefault();
    try {
      await dispatch(addToCart({ product, quantity: 1 })).unwrap();
      notify.success(`${product.title} added to your cart.`);
    } catch (message) {
      notify.error(message);
    }
  };

  const toggleWishlist = async (e) => {
    e.preventDefault();
    try {
      if (saved) await dispatch(removeFromWishlist(product.id)).unwrap();
      else await dispatch(addToWishlist(product)).unwrap();
    } catch (message) {
      notify.error(message);
    }
  };

  return (
    <Box
      component={RouterLink}
      to={`/products/${product.id}`}
      data-testid="product-card"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        textDecoration: 'none',
        color: 'text.primary',
        borderRadius: 1,
        p: compact ? 1.5 : 2,
        transition: 'background-color .15s',
        '&:hover': { bgcolor: 'background.neutral' },
        '&:hover .wishlist, &:focus-within .wishlist': { opacity: 1 },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ minHeight: 22, mb: 1 }}
      >
        <Box>
          {product.inStock === false ? (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label="Out of stock"
            />
          ) : product.lowStock ? (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label="Low stock"
            />
          ) : onSale ? (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label="Sale"
            />
          ) : null}
        </Box>
        {colors.length > 1 && <Swatches values={colors} />}
      </Stack>

      <Box sx={{ position: 'relative', aspectRatio: '1 / 1' }}>
        <Box
          component="img"
          src={product.images?.[0]}
          alt={product.title}
          loading="lazy"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px',
            display: 'block',
          }}
        />
        {shopper && (
          <IconButton
            className="wishlist"
            aria-label={
              saved
                ? `Remove ${product.title} from wishlist`
                : `Add ${product.title} to wishlist`
            }
            onClick={toggleWishlist}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              opacity: saved ? 1 : 0,
              transition: 'opacity .15s',
              bgcolor: 'background.paper',
              color: saved ? 'error.main' : 'text.secondary',
              '&:hover': { bgcolor: 'background.paper' },
              '@media (hover: none)': { opacity: 1 },
            }}
          >
            <FiHeart fill={saved ? 'currentColor' : 'none'} />
          </IconButton>
        )}
      </Box>

      <Stack
        spacing={0.75}
        sx={{ pt: 1.5, flex: 1, textAlign: 'center', alignItems: 'center' }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.title}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          justifyContent="center"
          flexWrap="wrap"
        >
          {[product.category?.name, product.brand?.name]
            .filter(Boolean)
            .map((label) => (
              <Chip
                key={label}
                size="small"
                label={label}
                sx={{ bgcolor: 'background.neutralDeep', fontWeight: 500 }}
              />
            ))}
        </Stack>
        {product.lowStock && product.inStock !== false && (
          <Typography variant="caption" color="text.secondary">
            Only {product.quantity} left in stock
          </Typography>
        )}
        {product.rating > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Rating
              value={Number(product.rating)}
              precision={0.5}
              size="small"
              readOnly
            />
            <Typography variant="caption">
              ({product.reviewCount} review
              {product.reviewCount === 1 ? '' : 's'})
            </Typography>
          </Stack>
        )}
        <Typography variant={compact ? 'h6' : 'h5'} component="p">
          {priceVaries && (
            <Typography component="span" variant="body2" color="text.secondary">
              From{' '}
            </Typography>
          )}
          {formatMoney(priceVaries ? product.minPrice : price)}
        </Typography>
        {onSale && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ textDecoration: 'line-through' }}
            >
              {formatMoney(product.price)}
            </Typography>
            <Chip
              size="small"
              color="success"
              label={`Save ${product.discountPercentage}%`}
              sx={{ color: '#fff' }}
            />
          </Stack>
        )}
        <Box sx={{ flex: 1 }} />
        {shopper &&
          (product.hasOptions ? (
            <Button
              size="small"
              variant="outlined"
              fullWidth
              sx={{ mt: 1 }}
              aria-label={`Choose options for ${product.title}`}
              tabIndex={-1}
            >
              Choose options
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              fullWidth
              startIcon={<FiShoppingCart />}
              onClick={add}
              disabled={product.inStock === false}
              aria-label={`Add ${product.title} to cart`}
              sx={{ mt: 1 }}
            >
              Add to cart
            </Button>
          ))}
      </Stack>
    </Box>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string,
    price: PropTypes.number,
    specialPrice: PropTypes.number,
    images: PropTypes.array,
  }).isRequired,
  compact: PropTypes.bool,
};

export default ProductCard;
