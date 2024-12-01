// src/pages/ProductDetailsPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getProductById } from '../services/productsService';
import { addItem } from '../redux/cartSlice';
import '../styles/productDetailsPage.css';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await getProductById(id);
        setProduct(data);
        setSelectedImage(data.images[0]);
      } catch (error) {
        console.error('Failed to fetch product:', error.message);
      }
    };

    loadProduct();
  }, [id]);

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
  };

  const handleAddToCart = () => {
    if (product) {
      dispatch(addItem({ ...product, size: selectedSize || null }));
      navigate('/cart'); // Navigate to cart after adding
    }
  };

  return (
    <div className="product-details-page">
      {/* Go Back Button */}
      <button onClick={() => navigate(-1)} className="go-back-button">
        &larr; Go Back
      </button>

      {product ? (
        <div className="product-details">
          {/* Left Column - Image Gallery */}
          <div className="product-details__images">
            {/* Main Image */}
            <div
              className="main-image-container"
              onClick={() => setIsImageDialogOpen(true)}
            >
              <img
                src={selectedImage}
                alt={product.title}
                className="main-image"
              />
            </div>
            {/* Thumbnail Images */}
            <div className="thumbnail-container">
              {product.images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={product.title}
                  onClick={() => handleImageClick(image)}
                  className={`thumbnail-image ${
                    image === selectedImage ? 'selected' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right Column - Product Details */}
          <div className="product-details__info">
            {/* Product Name */}
            <h1>{product.title}</h1>

            {/* Price */}
            <div className="price-container">
              {product.discountPercentage ? (
                <>
                  <span className="price">
                    $
                    {(
                      product.price -
                      product.price * (product.discountPercentage / 100)
                    ).toFixed(2)}
                  </span>
                  <span className="original-price">
                    ${product.price.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="price">${product.price.toFixed(2)}</span>
              )}
            </div>
            <p className="tax-info">Tax included.</p>

            {/* Ratings */}
            <div className="ratings-container">
              <div className="stars">
                {'★'.repeat(Math.round(product.rating || 0))}
                {'☆'.repeat(5 - Math.round(product.rating || 0))}
              </div>
              <p>Reviews ({product.reviewCount || 0})</p>
            </div>

            {/* Size Selection */}
            <div className="size-selection">
              <h3>Select Size:</h3>
              <div className="size-options">
                {['SM', 'MD', 'LG', 'XL'].map((size) => (
                  <button
                    key={size}
                    className={`size-button ${
                      selectedSize === size ? 'selected' : ''
                    }`}
                    onClick={() => handleSizeSelect(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="add-to-cart-button" onClick={handleAddToCart}>
                Add to Cart
              </button>

              <button
                className="continue-shopping-button"
                onClick={() => navigate('/products')}
              >
                Continue Shopping
              </button>
            </div>

            {/* About the Item */}
            <div className="about-item">
              <h3>About the item</h3>
              <p>{product.description}</p>
            </div>
          </div>
        </div>
      ) : (
        <p>Loading...</p>
      )}

      {/* Image Dialog */}
      {isImageDialogOpen && (
        <div className="image-dialog">
          <div className="image-dialog-content">
            <button
              className="dialog-close-button"
              onClick={() => setIsImageDialogOpen(false)}
            >
              &times;
            </button>
            <img
              src={selectedImage}
              alt={product.title}
              className="dialog-image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailsPage;
