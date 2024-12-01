// src/pages/ProductDetailsPage.js

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProductById } from '../services/productsService';
import { useDispatch } from 'react-redux';
import { addItem } from '../redux/cartSlice';
import '../styles/productDetailsPage.css';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const productData = await getProductById(id);
        setProduct(productData);
      } catch (error) {
        console.error('Failed to fetch product:', error.message);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    dispatch(addItem({ ...product, quantity }));
  };

  return (
    <div className="product-details-page">
      {product ? (
        <div className="product-details">
          <div className="product-details__images">
            {/* Image Carousel or Gallery */}
            <img
              src={product.images[0]}
              alt={product.title}
              className="product-details__main-image"
            />
            {/* Implement thumbnails if multiple images */}
          </div>
          <div className="product-details__info">
            <h1>{product.title}</h1>
            <div className="product-details__price">
              ${product.price}
              {/* Show original price if there's a discount */}
            </div>
            {/* Ratings and Reviews */}
            {/* Stock Availability */}
            <p>{product.description}</p>
            {/* Product Variants if any */}
            <div className="product-details__actions">
              <div className="quantity-selector">
                <button
                  onClick={() =>
                    setQuantity((prev) => (prev > 1 ? prev - 1 : 1))
                  }
                >
                  -
                </button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity((prev) => prev + 1)}>
                  +
                </button>
              </div>
              <button className="add-to-cart-button" onClick={handleAddToCart}>
                Add to Cart
              </button>
            </div>
            {/* Share Buttons */}
          </div>
        </div>
      ) : (
        <p>Loading product details...</p>
      )}
      {/* Related Products Section */}
    </div>
  );
};

export default ProductDetailsPage;
