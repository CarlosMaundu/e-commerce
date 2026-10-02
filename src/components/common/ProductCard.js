// src/components/common/ProductCard.js — Aurora-style product tile.
import React from 'react';
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
  Typography,
} from '@mui/material';
import { FiHeart, FiShoppingCart } from 'react-icons/fi';
import { addToCart } from '../../redux/cartSlice';
import {
  addToWishlist,
  isInWishlist,
  removeFromWishlist,
} from '../../redux/wishlistSlice';
import { useNotify } from '../../notification/NotificationProvider';
import { formatMoney } from '../../utils/format';

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();
  const notify = useNotify();
  const saved = useSelector((s) => isInWishlist(s, product.id));
  const onSale =
    product.specialPrice !== null &&
    product.specialPrice !== undefined &&
    product.specialPrice < product.price;
  const price = onSale ? product.specialPrice : product.price;
  const needsOptions =
    (product.sizes?.length || 0) > 0 || (product.colors?.length || 0) > 0;
  const lowStock =
    product.quantity !== null &&
    product.quantity !== undefined &&
    product.quantity > 0 &&
    product.quantity <= 5;

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
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        textDecoration: 'none',
        color: 'text.primary',
        borderRadius: 4,
        p: 1.5,
        transition: 'background-color .15s',
        '&:hover': { bgcolor: 'background.neutral' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '1 / 1',
          borderRadius: 3,
          bgcolor: 'background.neutral',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Box
          component="img"
          src={product.images?.[0]}
          alt={product.title}
          loading="lazy"
          sx={{ width: '80%', height: '80%', objectFit: 'contain' }}
        />
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ position: 'absolute', top: 10, left: 10 }}
        >
          {product.inStock === false && (
            <Chip
              size="small"
              label="Out of stock"
              sx={{ bgcolor: 'background.paper' }}
            />
          )}
          {lowStock && <Chip size="small" color="error" label="Low stock" />}
        </Stack>
        <IconButton
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
            bgcolor: 'background.paper',
            color: saved ? 'error.main' : 'text.secondary',
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <FiHeart fill={saved ? 'currentColor' : 'none'} />
        </IconButton>
      </Box>
      <Stack
        spacing={0.75}
        sx={{ pt: 1.5, flex: 1, textAlign: 'center', alignItems: 'center' }}
      >
        <Typography variant="subtitle2" sx={{ lineHeight: 1.35 }}>
          {product.title}
        </Typography>
        {product.category?.name && (
          <Chip
            size="small"
            label={product.category.name}
            sx={{ bgcolor: 'background.neutralDeep', fontWeight: 500 }}
          />
        )}
        {product.rating > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Rating
              value={Number(product.rating)}
              precision={0.5}
              size="small"
              readOnly
            />
            {product.reviewCount > 0 && (
              <Typography variant="caption">({product.reviewCount})</Typography>
            )}
          </Stack>
        )}
        <Typography variant="h5" component="p">
          {formatMoney(price)}
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
        {needsOptions ? (
          <Button size="small" variant="outlined" fullWidth sx={{ mt: 1 }}>
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
        )}
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
};

export default ProductCard;
