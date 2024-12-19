// src/components/common/ProductCard.js
import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { addItem } from '../../redux/cartSlice';
import { addToWishlist } from '../../redux/wishlistSlice';
import { Link } from 'react-router-dom';
import { FavoriteBorder, AddShoppingCart } from '@mui/icons-material';
import { Box, Typography, IconButton } from '@mui/material';

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();

  const handleAddToCart = (e) => {
    e.preventDefault();
    dispatch(addItem(product));
  };

  const handleAddToWishlist = (e) => {
    e.preventDefault();
    dispatch(addToWishlist(product));
  };

  const discount = product.discount || 0;
  const discountedPrice = discount
    ? product.price - (product.price * discount) / 100
    : product.price;

  return (
    <Box
      sx={{
        position: 'relative',
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'box-shadow 0.3s ease, transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        textAlign: 'left',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transform: 'translateY(-5px)',
        },
      }}
    >
      <Link
        to={`/products/${product.id}`}
        style={{ textDecoration: 'none', color: 'inherit', flexGrow: 1 }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            overflow: 'hidden',
          }}
        >
          <IconButton
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 2,
              color: 'rgba(0,0,0,0.6)',
              '&:hover': {
                color: 'red',
              },
            }}
            aria-label="Add to Wishlist"
            onClick={handleAddToWishlist}
          >
            <FavoriteBorder />
          </IconButton>
          <Box
            component="img"
            src={product.images[0]}
            alt={product.title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease',
              '&:hover': { transform: 'scale(1.05)' },
            }}
          />
        </Box>
      </Link>
      <Box sx={{ p: '10px 15px', display: 'flex', flexDirection: 'column' }}>
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            margin: '5px 0 10px 0',
            color: '#333',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {product.title}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography
              component="span"
              sx={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#000' }}
            >
              ${discountedPrice.toFixed(2)}
            </Typography>
            {discount > 0 && (
              <Typography
                component="span"
                sx={{
                  fontSize: '0.8rem',
                  color: '#6c757d',
                  textDecoration: 'line-through',
                  ml: '5px',
                }}
              >
                ${product.price.toFixed(2)}
              </Typography>
            )}
          </Box>
          <IconButton
            sx={{ color: '#007bff', '&:hover': { color: '#0056b3' }, p: 0 }}
            aria-label="Add to Cart"
            onClick={handleAddToCart}
          >
            <AddShoppingCart />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    discount: PropTypes.number,
    images: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
};

export default ProductCard;
