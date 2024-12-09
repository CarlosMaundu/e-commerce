import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import '../styles/checkoutPage.css';
import paymentMastercard from '../images/payment1.png'; // MasterCard
import paymentVisa from '../images/payment2.png'; // Visa
import paymentPaypal from '../images/payment3.png'; // PayPal
import {
  createPaymentIntent,
  confirmPaymentIntent,
} from '../services/paymentsService';

const CheckoutPage = () => {
  const navigate = useNavigate();
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

  // Form fields state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState(''); // MM/YY format
  const [cvv, setCvv] = useState('');

  // Error states
  const [errors, setErrors] = useState({});

  // Determine card logo based on payment method
  let cardLogo;
  if (paymentMethod === 'visa') {
    cardLogo = paymentVisa;
  } else if (paymentMethod === 'mastercard') {
    cardLogo = paymentMastercard;
  }

  // Validate inputs
  const validateInputs = () => {
    const newErrors = {};

    // Shipping info validation
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email))
      newErrors.email = 'Valid email is required';
    if (!streetAddress.trim())
      newErrors.streetAddress = 'Street address is required';
    if (!city.trim()) newErrors.city = 'City is required';
    if (!stateField.trim()) newErrors.stateField = 'State is required';
    if (!postalCode.trim() || !/^\d+$/.test(postalCode))
      newErrors.postalCode = 'Valid postal code is required';

    // Payment method validation
    if (paymentMethod === 'visa' || paymentMethod === 'mastercard') {
      if (!cardName.trim())
        newErrors.cardName = "Cardholder's name is required";

      const sanitizedCardNumber = cardNumber.replace(/\s+/g, '');
      if (!/^\d{16}$/.test(sanitizedCardNumber)) {
        newErrors.cardNumber = 'Card number must be 16 digits';
      }
      if (sanitizedCardNumber.length !== 16) {
        newErrors.cardNumber = 'Card number must be 16 digits';
      }

      // Expiry validation (MM/YY)
      const expMatch = expiry.match(/^(\d{2})\/(\d{2})$/);
      if (!expMatch) {
        newErrors.expiry = 'Expiry must be in MM/YY format';
      } else {
        const monthNum = parseInt(expMatch[1], 10);
        const yearNum = parseInt('20' + expMatch[2], 10); // assuming 20YY format
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        if (monthNum < 1 || monthNum > 12) {
          newErrors.expiry = 'Valid expiry month required';
        } else if (
          yearNum < currentYear ||
          (yearNum === currentYear && monthNum < currentMonth)
        ) {
          newErrors.expiry = 'Expiry date must be in the future';
        }
      }

      // CVV validation
      if (!/^\d{3,4}$/.test(cvv)) newErrors.cvv = 'CVV must be 3 or 4 digits';
    }

    if (!termsAccepted)
      newErrors.terms = 'You must accept Terms and Conditions';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Format card number as user types
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.match(/.{1,4}/g)?.join(' ') || '';
    setCardNumber(value);
  };

  const handleCvvChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvv(val);
  };

  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    // Format as MM/YY
    if (val.length > 4) val = val.slice(0, 4);
    if (val.length > 2) {
      val = val.slice(0, 2) + '/' + val.slice(2);
    }
    setExpiry(val);
  };

  const handleConfirmPayment = async () => {
    if (!validateInputs()) return;

    try {
      const paymentIntent = await createPaymentIntent(
        Math.round(total * 100),
        'usd'
      );

      // Extract month and year from expiry
      const expMatch = expiry.match(/^(\d{2})\/(\d{2})$/);
      const expMonth = expMatch ? parseInt(expMatch[1], 10) : '';
      const expYear = expMatch ? parseInt('20' + expMatch[2], 10) : '';

      const confirmed = await confirmPaymentIntent(paymentIntent.id, {
        cardNumber: cardNumber.replace(/\s/g, ''),
        expMonth,
        expYear,
        cvv,
      });

      if (confirmed.status === 'succeeded') {
        alert('Payment successful! Test card used: 4242 4242 4242 4242');
        navigate('/orders');
      } else {
        alert('Payment failed, please try again.');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert(`Payment error: ${error.message}`);
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
                <div className="form-field">
                  <label>Cardholder's Name</label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                  {errors.cardName && (
                    <span style={{ color: 'red', fontSize: '12px' }}>
                      {errors.cardName}
                    </span>
                  )}
                </div>
                <div className="form-field card-number-field">
                  <label>Card Number</label>
                  <div className="card-number-input">
                    {cardLogo && (
                      <img
                        src={cardLogo}
                        alt="Card Logo"
                        className="card-logo"
                      />
                    )}
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                    />
                  </div>
                  {errors.cardNumber && (
                    <span style={{ color: 'red', fontSize: '12px' }}>
                      {errors.cardNumber}
                    </span>
                  )}
                </div>
                <div className="form-field" style={{ marginTop: '8px' }}>
                  <label>EXP (MM/YY)</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={handleExpiryChange}
                    placeholder="MM/YY"
                  />
                  {errors.expiry && (
                    <span style={{ color: 'red', fontSize: '12px' }}>
                      {errors.expiry}
                    </span>
                  )}
                </div>
                <div className="form-field" style={{ marginTop: '8px' }}>
                  <label>CVV</label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={handleCvvChange}
                    placeholder="123"
                  />
                  {errors.cvv && (
                    <span style={{ color: 'red', fontSize: '12px' }}>
                      {errors.cvv}
                    </span>
                  )}
                </div>
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
    </div>
  );
};

export default CheckoutPage;
