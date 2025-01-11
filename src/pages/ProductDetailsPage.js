// src/pages/ProductDetailsPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getProductById } from '../services/productsService';
import { addItem } from '../redux/cartSlice';
import Breadcrumb from '../components/common/breadcrumb';

import {
  Box,
  Button,
  Typography,
  Grid,
  Divider,
  Skeleton,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import IosShareIcon from '@mui/icons-material/IosShare';
import StarIcon from '@mui/icons-material/Star';
import PeopleIcon from '@mui/icons-material/People';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('description');

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

  const handleImageClick = (image) => setSelectedImage(image);
  const handleSizeSelect = (size) => setSelectedSize(size);
  const handleColorSelect = (color) => setSelectedColor(color);

  const handleAddToCart = () => {
    if (product) {
      dispatch(
        addItem({
          ...product,
          size: selectedSize || null,
          color: selectedColor || null,
        })
      );
    }
  };

  const handleBuyNow = () => {
    if (product) {
      dispatch(
        addItem({
          ...product,
          size: selectedSize || null,
          color: selectedColor || null,
        })
      );
      navigate('/checkout');
    }
  };

  const handleContinueShopping = () => navigate('/products');

  const sizes = ['SM', 'MD', 'LG', 'XL'];
  const colors = ['#000000', '#9CA3AF', '#FB923C', '#F87171'];

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Product Details', href: '#' }, // Current page
  ];

  // If product is not loaded yet, show skeleton placeholders
  if (!product) {
    return (
      <Box
        sx={{
          width: '70vw',
          ml: 0,
          overflowX: 'hidden',
          fontFamily: 'sans-serif',
          p: { xs: 1, md: 4 },
        }}
      >
        {/* Breadcrumb skeleton */}
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width={200} height={24} />
        </Box>

        <Grid container spacing={1}>
          {/* Left Column Skeleton */}
          <Grid item xs={12} lg={6}>
            <Box sx={{ textAlign: 'left' }}>
              <Skeleton
                variant="rectangular"
                width="95%"
                height={500} // matches increased image height
                sx={{ mx: 'auto', borderRadius: '6px' }}
              />
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  justifyContent: 'flex-start',
                  mt: 1,
                }}
              >
                {[...Array(4)].map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rectangular"
                    width={40}
                    height={40}
                    sx={{ borderRadius: '4px' }}
                  />
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Right Column Skeleton */}
          <Grid item xs={12} lg={6}>
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box>
                  <Skeleton variant="text" width={120} height={24} />
                  <Skeleton variant="text" width={80} height={20} />
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Skeleton
                    variant="rectangular"
                    width={40}
                    height={20}
                    sx={{ borderRadius: '4px' }}
                  />
                  <Skeleton
                    variant="rectangular"
                    width={40}
                    height={20}
                    sx={{ borderRadius: '4px' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box>
                  <Skeleton variant="text" width={60} height={30} />
                  <Skeleton variant="text" width={100} height={20} />
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Skeleton
                    variant="rectangular"
                    width={40}
                    height={20}
                    sx={{ borderRadius: '4px' }}
                  />
                  <Skeleton
                    variant="rectangular"
                    width={40}
                    height={20}
                    sx={{ borderRadius: '4px' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Skeleton variant="text" width={100} height={20} />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rectangular"
                    width={36}
                    height={36}
                    sx={{ borderRadius: '4px' }}
                  />
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Skeleton variant="text" width={100} height={20} />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rectangular"
                    width={36}
                    height={36}
                    sx={{ borderRadius: '4px' }}
                  />
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Skeleton
                  variant="rectangular"
                  width={80}
                  height={30}
                  sx={{ borderRadius: '4px' }}
                />
                <Skeleton
                  variant="rectangular"
                  width={80}
                  height={30}
                  sx={{ borderRadius: '4px' }}
                />
                <Skeleton
                  variant="rectangular"
                  width={120}
                  height={30}
                  sx={{ borderRadius: '4px' }}
                />
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, maxWidth: '600px' }}>
          <Box
            sx={{
              display: 'flex',
              borderBottom: '1px solid #ddd',
              fontSize: '0.8rem',
            }}
          >
            <Skeleton variant="text" width={80} height={24} />
            <Skeleton variant="text" width={80} height={24} sx={{ ml: 2 }} />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Skeleton variant="text" width={120} height={24} />
            <Skeleton variant="text" width="100%" height={20} />
            <Skeleton variant="text" width="90%" height={20} />
          </Box>
        </Box>
      </Box>
    );
  }

  // Once product is loaded, display actual content
  const finalPrice = product.discountPercentage
    ? (
        product.price -
        product.price * (product.discountPercentage / 100)
      ).toFixed(2)
    : product.price.toFixed(2);

  const originalPrice = product.discountPercentage
    ? product.price.toFixed(2)
    : null;
  const ratingValue = product.rating || 0;
  const reviewCount = product.reviewCount || 0;
  const wishlistCount = 0; // Show 0 until integrated

  return (
    <Box
      sx={{
        width: '70vw',
        ml: 0,
        overflowX: 'hidden',
        fontFamily: 'sans-serif',
        p: { xs: 1, md: 2 },
      }}
    >
      {/* Breadcrumb with reduced text size in mobile */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumb
          items={breadcrumbItems}
          sx={{
            '& .MuiBreadcrumbs-ol': {
              flexWrap: 'nowrap',
              fontSize: { xs: '0.7rem', sm: '0.8rem', md: '1rem' },
            },
          }}
        />
      </Box>

      <Grid container spacing={1}>
        {/* Left Column - Images */}
        <Grid item xs={12} lg={6}>
          <Box sx={{ textAlign: 'left' }}>
            {/* Main image container with increased height and click-to-zoom */}
            <Box
              sx={{
                width: '100%',
                maxHeight: '500px',
                overflow: 'hidden',
                mb: 1,
                cursor: 'zoom-in',
              }}
            >
              <img
                src={selectedImage}
                alt={product.title}
                style={{
                  width: '95%',
                  height: 'auto',
                  borderRadius: '6px',
                  objectFit: 'cover',
                  maxHeight: '400px',
                }}
                onClick={() => setIsImageDialogOpen(true)}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
                mt: 1,
              }}
            >
              {product.images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`${product.title}-${index}`}
                  onClick={() => handleImageClick(image)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border:
                      image === selectedImage
                        ? '2px solid #000'
                        : '1px solid #ddd',
                    objectFit: 'cover',
                  }}
                />
              ))}
            </Box>
          </Box>
        </Grid>

        {/* Right Column - Product Details */}
        <Grid item xs={12} lg={6}>
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'start',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '0.9rem',
                  }}
                >
                  {product.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'gray.500', mt: 0.5, fontSize: '0.7rem' }}
                >
                  {product.brand || 'Brand Name'}
                </Typography>
              </Box>

              <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                {/* Wishlist count */}
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: '#fce7f3',
                    color: '#db2777',
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    p: '2px 6px',
                    minWidth: 'auto',
                    '&:hover': { backgroundColor: '#fbcfe8' },
                  }}
                  startIcon={
                    <FavoriteIcon sx={{ width: '10px', height: '10px' }} />
                  }
                >
                  {wishlistCount}
                </Button>

                {/* Share button */}
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: '#f3f4f6',
                    color: '#111827',
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    p: '2px 6px',
                    minWidth: 'auto',
                    '&:hover': { backgroundColor: '#e5e7eb' },
                  }}
                  startIcon={
                    <IosShareIcon sx={{ width: '10px', height: '10px' }} />
                  }
                >
                  Share
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'start',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontWeight: 'bold', color: '#333', fontSize: '1.2rem' }}
                >
                  ${finalPrice}
                </Typography>
                {originalPrice && (
                  <Typography
                    variant="body2"
                    sx={{ color: 'gray.500', mt: 0.5, fontSize: '0.7rem' }}
                  >
                    <strike>${originalPrice}</strike>{' '}
                    <span style={{ marginLeft: '4px' }}>Tax included</span>
                  </Typography>
                )}
                {!originalPrice && (
                  <Typography
                    variant="body2"
                    sx={{ color: 'gray.500', mt: 0.5, fontSize: '0.7rem' }}
                  >
                    Tax included
                  </Typography>
                )}
              </Box>

              <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                {/* Average Rating with Star */}
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: '#fce7f3',
                    color: '#db2777',
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    p: '2px 6px',
                    minWidth: 'auto',
                    '&:hover': { backgroundColor: '#fbcfe8' },
                  }}
                  startIcon={
                    <StarIcon sx={{ width: '10px', height: '10px' }} />
                  }
                >
                  {ratingValue.toFixed(1)}
                </Button>

                {/* Total Reviews */}
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: '#f3f4f6',
                    color: '#111827',
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    p: '2px 6px',
                    minWidth: 'auto',
                    '&:hover': { backgroundColor: '#e5e7eb' },
                  }}
                  startIcon={
                    <PeopleIcon sx={{ width: '10px', height: '10px' }} />
                  }
                >
                  {reviewCount} Reviews
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Size Selection */}
            <Box>
              <Typography
                sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}
              >
                Choose a Size
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {sizes.map((size) => (
                  <Button
                    key={size}
                    variant={selectedSize === size ? 'contained' : 'outlined'}
                    onClick={() => handleSizeSelect(size)}
                    sx={{
                      width: '36px',
                      height: '36px',
                      minWidth: '36px',
                      p: 0,
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      borderRadius: '4px',
                    }}
                  >
                    {size}
                  </Button>
                ))}
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Color Selection */}
            <Box>
              <Typography
                sx={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}
              >
                Choose a Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {colors.map((color) => (
                  <Box
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    sx={{
                      width: '36px',
                      height: '36px',
                      border:
                        selectedColor === color
                          ? '2px solid #000'
                          : '2px solid #fff',
                      backgroundColor: color,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      '&:hover': { borderColor: '#333' },
                    }}
                  />
                ))}
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: 'blue.600',
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  '&:hover': { backgroundColor: '#1e40af' },
                  minWidth: '100px',
                  py: 0.5,
                }}
                onClick={handleBuyNow}
              >
                Buy now
              </Button>
              <Button
                variant="outlined"
                sx={{
                  borderColor: '#1f2937',
                  color: '#1f2937',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  '&:hover': { backgroundColor: '#f9fafb' },
                  minWidth: '100px',
                  py: 0.5,
                }}
                onClick={handleAddToCart}
              >
                Add to cart
              </Button>
              <Button
                variant="text"
                sx={{
                  color: '#1f2937',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  '&:hover': { backgroundColor: '#f9fafb' },
                  minWidth: '120px',
                }}
                onClick={handleContinueShopping}
              >
                Continue Shopping
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Tabs for Description and Reviews */}
      <Box sx={{ mt: 2, maxWidth: '600px' }}>
        <Box
          sx={{
            display: 'flex',
            borderBottom: '1px solid #ddd',
            fontSize: '0.8rem',
          }}
        >
          <Box
            sx={{
              py: 1,
              px: 2,
              cursor: 'pointer',
              borderBottom:
                activeTab === 'description'
                  ? '2px solid #000'
                  : '2px solid transparent',
              color: activeTab === 'description' ? '#000' : 'gray.500',
              fontWeight: 'bold',
              fontSize: '0.8rem',
            }}
            onClick={() => setActiveTab('description')}
          >
            Description
          </Box>
          <Box
            sx={{
              py: 1,
              px: 2,
              cursor: 'pointer',
              borderBottom:
                activeTab === 'reviews'
                  ? '2px solid #000'
                  : '2px solid transparent',
              color: activeTab === 'reviews' ? '#000' : 'gray.500',
              fontWeight: 'bold',
              fontSize: '0.8rem',
            }}
            onClick={() => setActiveTab('reviews')}
          >
            Reviews
          </Box>
        </Box>

        {activeTab === 'description' && (
          <Box sx={{ mt: 2 }}>
            <Typography
              sx={{
                fontWeight: 'bold',
                color: '#333',
                fontSize: '0.9rem',
                mb: 1,
              }}
            >
              Product Description
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'gray.500', fontSize: '0.8rem' }}
            >
              {product.description}
            </Typography>
          </Box>
        )}

        {activeTab === 'reviews' && (
          <Box sx={{ mt: 2 }}>
            <Typography
              sx={{
                fontWeight: 'bold',
                color: '#333',
                fontSize: '0.9rem',
                mb: 1,
              }}
            >
              Reviews
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'gray.500', fontSize: '0.8rem' }}
            >
              No reviews available yet.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Image Dialog - same functionality, now triggered by clicking the main image */}
      {isImageDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setIsImageDialogOpen(false)}
        >
          <img
            src={selectedImage}
            alt={product.title}
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '6px' }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ProductDetailsPage;
