// src/pages/CartPage.js

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  removeItem,
  incrementQuantity,
  decrementQuantity,
} from '../redux/cartSlice';
import { addToWishlist } from '../redux/wishlistSlice';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/cartPage.css';

const CartPage = () => {
  const cartItems = useSelector((state) => state.cart.items);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Calculate totals
  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const shipping = 10; // Flat shipping fee
  const taxRate = 0.08; // 8% tax
  const tax = subtotal * taxRate;
  const total = subtotal + shipping + tax;

  return (
    <div className="cart-page">
      {/* Go Back Button */}
      <button onClick={() => navigate(-1)} className="cart-go-back-button">
        &larr; Go Back
      </button>

      <h1>Your Shopping Cart</h1>

      <div className="cart-content">
        {/* Left Column - Cart Items */}
        <div className="cart-items">
          {cartItems.length > 0 ? (
            <>
              {cartItems.map((item) => (
                <div className="cart-item" key={item.id + item.size}>
                  <div className="cart-item-image">
                    <Link to={`/products/${item.id}`}>
                      <img src={item.images[0]} alt={item.title} />
                    </Link>
                  </div>
                  <div className="cart-item-details">
                    <h3>
                      <Link
                        to={`/products/${item.id}`}
                        className="cart-item-title"
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p>Size: {item.size || 'N/A'}</p>
                    <div className="cart-item-price">
                      ${item.price.toFixed(2)}
                    </div>
                    <div className="cart-item-quantity">
                      <button
                        onClick={() =>
                          dispatch(
                            decrementQuantity({ id: item.id, size: item.size })
                          )
                        }
                        disabled={item.quantity <= 1}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() =>
                          dispatch(
                            incrementQuantity({ id: item.id, size: item.size })
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-item-actions">
                      <button
                        className="remove-button"
                        onClick={() =>
                          dispatch(removeItem({ id: item.id, size: item.size }))
                        }
                      >
                        Remove
                      </button>
                      <button
                        className="wishlist-button"
                        onClick={() => {
                          dispatch(addToWishlist(item));
                          dispatch(
                            removeItem({ id: item.id, size: item.size })
                          );
                        }}
                      >
                        Move to Wishlist
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Continue Shopping Button at the bottom */}
              <div className="continue-shopping-bottom">
                <button
                  className="continue-shopping-button"
                  onClick={() => navigate('/products')}
                >
                  &larr; Continue Shopping
                </button>
              </div>
            </>
          ) : (
            <p>
              Your cart is empty. <Link to="/products">Continue shopping</Link>.
            </p>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="order-summary">
          <h2>Order Summary</h2>
          <div className="order-summary-details">
            <div className="order-summary-item">
              <span>Subtotal</span>
              <span className="amount">${subtotal.toFixed(2)}</span>
            </div>
            <div className="order-summary-item">
              <span>Shipping</span>
              <span className="amount">${shipping.toFixed(2)}</span>
            </div>
            <div className="order-summary-item">
              <span>Tax</span>
              <span className="amount">${tax.toFixed(2)}</span>
            </div>
            <div className="order-summary-total">
              <span>Total</span>
              <span className="amount">${total.toFixed(2)}</span>
            </div>
          </div>
          <button className="checkout-button">Make Payment</button>

          {/* Promo Code Application */}
          <div className="promo-code">
            <input type="text" placeholder="Enter promo code" />
            <button className="apply-button">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
