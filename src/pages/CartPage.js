// src/pages/CartPage.js
import React, { useContext, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  removeItem,
  incrementQuantity,
  decrementQuantity,
} from '../redux/cartSlice';
import { addToWishlist } from '../redux/wishlistSlice';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Skeleton,
  TextField,
  IconButton,
  Divider,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import UserTypeModal from '../components/common/UserTypeModal';

const CartPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Retrieve cart items and loading state from Redux
  const {
    items: cartItems,
    loading,
    error,
  } = useSelector((state) => state.cart);

  // Calculate totals
  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const shipping = 10; // Flat shipping fee
  const taxRate = 0.08; // 8% tax
  const tax = subtotal * taxRate;
  const total = subtotal + shipping + tax;

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);

  const handleCheckout = () => {
    if (!user) {
      // User not authenticated, show prompt
      setShowAuthPrompt(true);
    } else {
      // User is authenticated, proceed to checkout
      navigate('/checkout');
    }
  };

  const handleApplyPromo = () => {
    // Placeholder logic for applying promo code
    if (promoCode.trim().toUpperCase() === 'FRIDAY35') {
      setAppliedPromo({ code: promoCode.toUpperCase(), discount: 0.35 });
      // Optionally, adjust totals based on promo
      // For simplicity, we're just storing the applied promo
    } else {
      alert('Invalid promo code');
    }
  };

  return (
    <Box
      sx={{
        fontFamily: 'sans-serif',
        p: { xs: 2, lg: 4 },
        backgroundColor: '#f5f5f5',
      }}
    >
      <Grid container spacing={3}>
        {/* Left Column - Cart Items */}
        <Grid item lg={8} xs={12}>
          <Box
            sx={{
              backgroundColor: 'white',
              p: { xs: 2, lg: 4 },
              borderRadius: '8px',
              boxShadow: 1,
              position: 'relative',
            }}
          >
            {/* Cart Items */}
            {loading ? (
              // Show Skeleton placeholders
              <>
                {Array.from({ length: 3 }).map((_, index) => (
                  <Box key={index} sx={{ mb: 4 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Skeleton
                          variant="rectangular"
                          width="100%"
                          height={100}
                          sx={{ borderRadius: '8px' }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={8}>
                        <Skeleton
                          variant="text"
                          width="60%"
                          height={30}
                          sx={{ mb: 1 }}
                        />
                        <Skeleton
                          variant="text"
                          width="40%"
                          height={20}
                          sx={{ mb: 1 }}
                        />
                        <Skeleton
                          variant="text"
                          width="30%"
                          height={20}
                          sx={{ mb: 1 }}
                        />
                        <Skeleton
                          variant="text"
                          width="50%"
                          height={20}
                          sx={{ mb: 2 }}
                        />
                        <Skeleton
                          variant="rectangular"
                          width="100%"
                          height={40}
                          sx={{ borderRadius: '4px' }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </>
            ) : error ? (
              <Typography
                variant="body1"
                sx={{
                  color: 'red',
                  fontSize: '1.2rem',
                  mt: 2,
                  textAlign: 'center',
                }}
              >
                Error loading products. Please try again later.
              </Typography>
            ) : cartItems.length > 0 ? (
              <>
                {cartItems.map((item) => (
                  <Box
                    key={`${item.id}-${item.size}`}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2,
                      py: 2,
                      borderBottom: '1px solid #ddd',
                      alignItems: { sm: 'center' },
                    }}
                  >
                    {/* Product Image */}
                    <Box
                      sx={{
                        width: '100px',
                        height: '100px',
                        flexShrink: 0,
                        overflow: 'hidden',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: { xs: 2, sm: 0 },
                      }}
                    >
                      <Link to={`/products/${item.id}`}>
                        <Box
                          component="img"
                          src={item.images[0]}
                          alt={item.title}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      </Link>
                    </Box>

                    {/* Product Details */}
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 'bold',
                          color: '#333',
                          fontSize: { xs: '0.95rem', sm: '1rem' },
                          mb: 0.5,
                        }}
                      >
                        <Link
                          to={`/products/${item.id}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {item.title}
                        </Link>
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: '#555', fontSize: '0.75rem' }}
                      >
                        Size: <strong>{item.size || 'N/A'}</strong>
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: '#555', fontSize: '0.75rem' }}
                      >
                        Color: <strong>{item.color || 'N/A'}</strong>
                      </Typography>

                      {/* Action Buttons */}
                      <Box
                        sx={{
                          mt: 2,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Button
                          variant="text"
                          sx={{
                            color: 'red',
                            fontSize: '0.75rem',
                            textTransform: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontWeight: 'bold',
                          }}
                          onClick={() =>
                            dispatch(
                              removeItem({ id: item.id, size: item.size })
                            )
                          }
                          startIcon={<DeleteIcon sx={{ fontSize: '16px' }} />}
                        >
                          Remove
                        </Button>
                        <Button
                          variant="text"
                          sx={{
                            color: '#C71585',
                            fontSize: '0.75rem',
                            textTransform: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontWeight: 'bold',
                            whiteSpace: { xs: 'nowrap', sm: 'normal' },
                          }}
                          onClick={() => {
                            dispatch(addToWishlist(item));
                            dispatch(
                              removeItem({ id: item.id, size: item.size })
                            );
                          }}
                          startIcon={
                            <FavoriteBorderIcon sx={{ fontSize: '16px' }} />
                          }
                        >
                          Move to wish list
                        </Button>
                      </Box>
                    </Box>

                    {/* Quantity and Price */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: { sm: 'flex-end' },
                        mt: { xs: 2, sm: 0 },
                        textAlign: { xs: 'left', sm: 'right' },
                      }}
                    >
                      {/* Quantity Adjusters */}
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <IconButton
                          size="small"
                          onClick={() =>
                            dispatch(
                              decrementQuantity({
                                id: item.id,
                                size: item.size,
                              })
                            )
                          }
                          disabled={item.quantity <= 1}
                          sx={{
                            backgroundColor: '#007bff',
                            '&:hover': { backgroundColor: '#0056b3' },
                            borderRadius: '50%',
                            padding: '6px',
                          }}
                        >
                          <RemoveIcon
                            sx={{ fontSize: '14px', color: 'white' }}
                          />
                        </IconButton>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                        >
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() =>
                            dispatch(
                              incrementQuantity({
                                id: item.id,
                                size: item.size,
                              })
                            )
                          }
                          sx={{
                            backgroundColor: '#007bff',
                            '&:hover': { backgroundColor: '#0056b3' },
                            borderRadius: '50%',
                            padding: '6px',
                          }}
                        >
                          <AddIcon sx={{ fontSize: '14px', color: 'white' }} />
                        </IconButton>
                      </Box>

                      {/* Price */}
                      <Typography
                        variant="body1"
                        sx={{
                          mt: 2,
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '0.95rem',
                        }}
                      >
                        ${item.price.toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </>
            ) : (
              <Typography
                variant="body1"
                sx={{ color: 'gray.600', textAlign: 'center', mt: 4 }}
              >
                Your cart is empty.
              </Typography>
            )}
          </Box>
        </Grid>

        {/* Right Column - Order Summary */}
        <Grid item lg={4} xs={12}>
          <Box
            sx={{
              backgroundColor: 'white',
              p: 3,
              borderRadius: '8px',
              boxShadow: 1,
              position: { lg: 'sticky' },
              top: { lg: '80px' },
            }}
          >
            {/* Order Summary Title */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                borderBottom: '1px solid #ddd',
                pb: 1,
                fontSize: '1rem',
              }}
            >
              Order Summary
            </Typography>

            {/* Order Summary Details */}
            <Box sx={{ mt: 2 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}
              >
                <Typography variant="body2">Subtotal</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  ${subtotal.toFixed(2)}
                </Typography>
              </Box>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}
              >
                <Typography variant="body2">Shipping</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  ${shipping.toFixed(2)}
                </Typography>
              </Box>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}
              >
                <Typography variant="body2">Tax</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  ${tax.toFixed(2)}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              >
                <Typography variant="body1">Total</Typography>
                <Typography variant="body1">${total.toFixed(2)}</Typography>
              </Box>

              {/* Checkout Button */}
              <Button
                variant="contained"
                onClick={handleCheckout}
                sx={{
                  mt: 3,
                  width: '100%',
                  backgroundColor: '#007bff',
                  '&:hover': { backgroundColor: '#0056b3' },
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  py: 1.5,
                  borderRadius: '4px',
                }}
              >
                Proceed to Checkout
              </Button>

              {/* Continue Shopping Button */}
              <Button
                variant="outlined"
                onClick={() => navigate('/products')}
                sx={{
                  mt: 2,
                  width: '100%',
                  borderColor: '#007bff',
                  color: '#007bff',
                  '&:hover': {
                    backgroundColor: '#e0e0e0',
                    borderColor: '#0056b3',
                  },
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  py: 1.5,
                  borderRadius: '4px',
                }}
              >
                Continue Shopping
              </Button>
            </Box>

            {/* Promo Code Section */}
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 1, fontSize: '0.95rem' }}
              >
                Apply promo code
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  border: '1px solid #007bff',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <TextField
                  variant="outlined"
                  placeholder="Promo code"
                  size="small"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px 0 0 8px',
                      padding: 0.5,
                    },
                    '& .MuiOutlinedInput-input': {
                      padding: '8px',
                      fontSize: '0.75rem',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleApplyPromo}
                  sx={{
                    backgroundColor: '#007bff',
                    '&:hover': { backgroundColor: '#0056b3' },
                    fontSize: '0.75rem',
                    padding: '8px 12px',
                    borderRadius: '0 8px 8px 0',
                    textTransform: 'none',
                  }}
                >
                  Apply
                </Button>
              </Box>

              {/* Applied Promo Code */}
              {appliedPromo && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 2,
                    backgroundColor: '#d4edda',
                    color: '#155724',
                    padding: 1,
                    borderRadius: '4px',
                  }}
                >
                  <Typography variant="body2">
                    Promo code <strong>{appliedPromo.code}</strong> applied!
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setAppliedPromo(null)}
                    sx={{ color: '#155724' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Auth Prompt Overlay */}
      {showAuthPrompt && !user && (
        <UserTypeModal
          open={showAuthPrompt}
          onClose={() => setShowAuthPrompt(false)}
        />
      )}
    </Box>
  );
};

export default CartPage;
