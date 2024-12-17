// src/components/common/ProductCard.js

import React from 'react';
import PropTypes from 'prop-types';
import '../../styles/ProductCard.css';
import { useDispatch } from 'react-redux';
import { addItem } from '../../redux/cartSlice';
import { addToWishlist } from '../../redux/wishlistSlice';
import { Link } from 'react-router-dom';
import { FavoriteBorder, AddShoppingCart } from '@mui/icons-material';

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();

  const handleAddToCart = () => {
    dispatch(addItem(product));
  };

  const handleAddToWishlist = () => {
    dispatch(addToWishlist(product));
  };

  // Calculate discount if applicable
  const discount = product.discount || 0;
  const discountedPrice = discount
    ? product.price - (product.price * discount) / 100
    : product.price;

  return (
    <div className="product-card">
      {/* Product Image */}
      <Link to={`/products/${product.id}`} className="product-card__link">
        <div className="product-card__image-container">
          {/* Wishlist Icon */}
          <button
            className="product-card__wishlist-button"
            aria-label="Add to Wishlist"
            onClick={(e) => {
              e.preventDefault(); // Prevent navigation when clicking the button
              handleAddToWishlist();
            }}
          >
            <FavoriteBorder className="product-card__wishlist-icon" />
          </button>
          <img
            src={product.images[0]}
            alt={product.title}
            className="product-card__image"
          />
        </div>
      </Link>

      {/* Product Details */}
      <div className="product-card__details">
        <h3 className="product-card__name">{product.title}</h3>
        <div className="product-card__price-cart">
          <span className="product-card__price">
            ${discountedPrice.toFixed(2)}
            {discount > 0 && (
              <span className="product-card__original-price">
                ${product.price.toFixed(2)}
              </span>
            )}
          </span>
          <button
            className="product-card__add-to-cart-button"
            aria-label="Add to Cart"
            onClick={handleAddToCart}
          >
            <AddShoppingCart className="product-card__add-to-cart-icon" />
          </button>
        </div>
      </div>
    </div>
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
