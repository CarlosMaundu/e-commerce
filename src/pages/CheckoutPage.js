// src/pages/CheckoutPage.js

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import '../styles/checkoutPage.css';
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
    <div className="checkout-page">
      <div className="checkout-content">
        {/* Left Column - Checkout Form */}
        <div className="checkout-form-column">
          <h1 className="checkout-title">Checkout</h1>

          {/* Shipping Info Section */}
          <div className="checkout-section shipping-info">
            <h2 className="section-title">Shipping Information</h2>
            <div className="two-column-grid">
              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.name}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.email}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>Street Address</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                />
                {errors.streetAddress && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.streetAddress}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                {errors.city && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.city}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>State</label>
                <input
                  type="text"
                  value={stateField}
                  onChange={(e) => setStateField(e.target.value)}
                />
                {errors.stateField && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.stateField}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
                {errors.postalCode && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.postalCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="checkout-section payment-method">
            <h2 className="section-title">Payment Method</h2>
            <div className="payment-options">
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="visa"
                  checked={paymentMethod === 'visa'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <img src={paymentVisa} alt="Visa" className="payment-icon" />
                Visa
              </label>

              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="mastercard"
                  checked={paymentMethod === 'mastercard'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <img
                  src={paymentMastercard}
                  alt="MasterCard"
                  className="payment-icon"
                />
                MasterCard
              </label>

              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paypal"
                  checked={paymentMethod === 'paypal'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <img
                  src={paymentPaypal}
                  alt="PayPal"
                  className="payment-icon"
                />
                PayPal
              </label>
            </div>

            {(paymentMethod === 'visa' || paymentMethod === 'mastercard') && (
              <div className="card-details">
                <label>Card Details</label>
                <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <CardElement />
                </div>
                {errors.card && (
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    {errors.card}
                  </span>
                )}
              </div>
            )}

            {paymentMethod === 'paypal' && (
              <div className="paypal-info">
                <p>
                  You will be redirected to PayPal to complete your payment.
                </p>
              </div>
            )}

            <div className="terms-conditions">
              <label className="tc-label">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                I accept the{' '}
                <a href="/terms" className="tc-link">
                  Terms and Conditions
                </a>
                .
              </label>
              {errors.terms && (
                <span style={{ color: 'red', fontSize: '12px' }}>
                  {errors.terms}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="checkout-actions">
            <button className="back-button" onClick={() => navigate('/cart')}>
              Back
            </button>
            <button
              className="confirm-payment-button"
              disabled={!termsAccepted}
              onClick={handleConfirmPayment}
            >
              Confirm payment ${total.toFixed(2)}
            </button>
          </div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="order-summary-column">
          <div className="order-summary-container">
            <h2>Order Summary</h2>
            <div className="product-list">
              {cartItems.map((item) => (
                <div className="product-row" key={item.id + item.size}>
                  <div className="product-entry">
                    <div className="product-image">
                      <img src={item.images[0]} alt={item.title} />
                    </div>
                    <div className="product-details-grid">
                      <div className="name-row">
                        <span className="label">Name:</span>
                        <span className="value">{item.title}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Size:</span>
                        <span className="value">{item.size || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Qty:</span>
                        <span className="value">{item.quantity}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Price:</span>
                        <span className="value">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="summary-line">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-line">
              <span>Shipping</span>
              <span>${shipping.toFixed(2)}</span>
            </div>
            <div className="summary-line">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
      <Notification
        open={notification.open}
        onClose={handleNotificationClose}
        severity={notification.severity}
        message={notification.message}
      />
    </div>
  );
};

export default function CheckoutPage() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}
