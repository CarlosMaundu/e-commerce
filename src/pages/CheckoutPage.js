// src/pages/CheckoutPage.js

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormHelperText,
  Divider,
} from '@mui/material';
import paymentMastercard from '../images/payment1.png'; // MasterCard
import paymentVisa from '../images/payment2.png'; // Visa
import paymentPaypal from '../images/payment3.png'; // PayPal
import {
  createPaymentIntent,
  confirmPaymentIntent,
} from '../services/paymentsService';
import Notification from '../notification/notification';

import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

import { clearCart } from '../redux/cartSlice';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);

  // Calculate totals
  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const shipping = 10; // Flat shipping fee
  const taxRate = 0.08; // 8% tax
  const tax = subtotal * taxRate;
  const total = subtotal + shipping + tax;

  const [paymentMethod, setPaymentMethod] = useState('visa');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Error states
  const [errors, setErrors] = useState({});

  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  const stripe = useStripe();
  const elements = useElements();

  const handleNotificationClose = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Validate inputs (no card validation needed manually, Stripe handles it)
  const validateInputs = () => {
    const newErrors = {};

    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email))
      newErrors.email = 'Valid email is required';
    if (!streetAddress.trim())
      newErrors.streetAddress = 'Street address is required';
    if (!city.trim()) newErrors.city = 'City is required';
    if (!stateField.trim()) newErrors.stateField = 'State is required';
    if (!postalCode.trim() || !/^\d+$/.test(postalCode))
      newErrors.postalCode = 'Valid postal code is required';

    if (
      (paymentMethod === 'visa' || paymentMethod === 'mastercard') &&
      !elements?.getElement(CardElement)
    ) {
      newErrors.card = 'Card details are required';
    }

    if (!termsAccepted)
      newErrors.terms = 'You must accept Terms and Conditions';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirmPayment = async () => {
    if (!validateInputs()) return;

    try {
      const paymentIntent = await createPaymentIntent(
        Math.round(total * 100),
        'usd'
      );

      if (!stripe || !elements) {
        setNotification({
          open: true,
          message: 'Stripe is not loaded yet. Please try again.',
          severity: 'error',
        });
        return;
      }

      // Create a PaymentMethod using Stripe Elements
      const cardElement = elements.getElement(CardElement);
      const { paymentMethod: stripePaymentMethod, error } =
        await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name,
            email,
            address: {
              line1: streetAddress,
              city: city,
              state: stateField,
              postal_code: postalCode,
            },
          },
        });

      if (error) {
        setErrors((prev) => ({ ...prev, card: error.message }));
        return;
      }

      // Confirm the PaymentIntent with the PaymentMethod ID
      const confirmed = await confirmPaymentIntent(
        paymentIntent.id,
        stripePaymentMethod.id
      );

      if (confirmed.status === 'succeeded') {
        // Clear the cart after successful payment
        dispatch(clearCart());

        // Show success notification
        setNotification({
          open: true,
          message: 'Payment successful!',
          severity: 'success',
        });

        // Redirect to the user's orders after a short delay
        setTimeout(() => {
          navigate('/profile?section=orders');
        }, 2000);
      } else {
        setNotification({
          open: true,
          message: 'Payment failed, please try again.',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setNotification({
        open: true,
        message: `Payment error: ${error.message}`,
        severity: 'error',
      });
    }
  };

  return (
    <Box
      sx={{
        fontFamily: 'sans-serif',
        p: { xs: 2, lg: 4 },
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      <Grid container spacing={3}>
        {/* Order Summary Column - Positioned above on small screens */}
        <Grid item lg={4} xs={12} order={{ xs: 1, lg: 2 }}>
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
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* Product List */}
            <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
              {cartItems.map((item) => (
                <Box
                  key={`${item.id}-${item.size}`}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    mb: 2,
                    alignItems: { xs: 'flex-start', sm: 'center' },
                  }}
                >
                  <Box
                    sx={{
                      width: '80px',
                      height: '80px',
                      mr: { sm: 2 },
                      mb: { xs: 1, sm: 0 },
                      flexShrink: 0,
                      overflow: 'hidden',
                      borderRadius: '8px',
                    }}
                  >
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2">
                      Size: {item.size || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Color: {item.color || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Price: ${(item.price * item.quantity).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Summary Details */}
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body2">Subtotal</Typography>
              <Typography variant="body2">${subtotal.toFixed(2)}</Typography>
            </Box>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body2">Shipping</Typography>
              <Typography variant="body2">${shipping.toFixed(2)}</Typography>
            </Box>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body2">Tax</Typography>
              <Typography variant="body2">${tax.toFixed(2)}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}
            >
              <Typography variant="h6">Total</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                ${total.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Left Column - Checkout Form */}
        <Grid item lg={8} xs={12} order={{ xs: 2, lg: 1 }}>
          <Box
            sx={{
              backgroundColor: 'white',
              p: { xs: 2, lg: 4 },
              borderRadius: '8px',
              boxShadow: 1,
            }}
          >
            <Typography variant="h4" gutterBottom>
              Checkout
            </Typography>

            {/* Shipping Information */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Shipping Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={!!errors.email}
                    helperText={errors.email}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Street Address"
                    fullWidth
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    error={!!errors.streetAddress}
                    helperText={errors.streetAddress}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="City"
                    fullWidth
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    error={!!errors.city}
                    helperText={errors.city}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="State"
                    fullWidth
                    value={stateField}
                    onChange={(e) => setStateField(e.target.value)}
                    error={!!errors.stateField}
                    helperText={errors.stateField}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Postal Code"
                    fullWidth
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    error={!!errors.postalCode}
                    helperText={errors.postalCode}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Payment Method */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Payment Method
              </Typography>
              <RadioGroup
                row
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <FormControlLabel
                  value="visa"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <img
                        src={paymentVisa}
                        alt="Visa"
                        style={{ width: '40px', marginRight: '8px' }}
                      />
                      Visa
                    </Box>
                  }
                />
                <FormControlLabel
                  value="mastercard"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <img
                        src={paymentMastercard}
                        alt="MasterCard"
                        style={{ width: '40px', marginRight: '8px' }}
                      />
                      MasterCard
                    </Box>
                  }
                />
                <FormControlLabel
                  value="paypal"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <img
                        src={paymentPaypal}
                        alt="PayPal"
                        style={{ width: '40px', marginRight: '8px' }}
                      />
                      PayPal
                    </Box>
                  }
                />
              </RadioGroup>
              {errors.paymentMethod && (
                <FormHelperText error>{errors.paymentMethod}</FormHelperText>
              )}

              {/* Card Details */}
              {(paymentMethod === 'visa' || paymentMethod === 'mastercard') && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" gutterBottom>
                    Card Details
                  </Typography>
                  <Box
                    sx={{
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      padding: '8px',
                      mb: 1,
                    }}
                  >
                    <CardElement />
                  </Box>
                  {errors.card && (
                    <Typography variant="body2" color="error">
                      {errors.card}
                    </Typography>
                  )}
                </Box>
              )}

              {/* PayPal Info */}
              {paymentMethod === 'paypal' && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1">
                    You will be redirected to PayPal to complete your payment.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Terms and Conditions */}
            <Box sx={{ mb: 4 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    I accept the{' '}
                    <a href="/terms" style={{ color: '#1976d2' }}>
                      Terms and Conditions
                    </a>
                    .
                  </Typography>
                }
              />
              {errors.terms && (
                <FormHelperText error>{errors.terms}</FormHelperText>
              )}
            </Box>

            {/* Action Buttons */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => navigate('/cart')}
                sx={{
                  backgroundColor: '#e0e0e0',
                  color: '#000',
                  '&:hover': { backgroundColor: '#d5d5d5' },
                  textTransform: 'none',
                  borderColor: 'transparent', // Remove border
                }}
              >
                Back to Cart
              </Button>
              <Button
                variant="contained"
                disabled={!termsAccepted}
                onClick={handleConfirmPayment}
                sx={{
                  backgroundColor: '#1976d2',
                  '&:hover': { backgroundColor: '#115293' },
                  textTransform: 'uppercase',
                }}
              >
                Confirm Payment: ${total.toFixed(2)}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Notification Component */}
      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </Box>
  );
};

export default function CheckoutPage() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}
