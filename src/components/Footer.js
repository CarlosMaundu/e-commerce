// src/components/Footer.js

import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/footer.css'; // Ensure this path is correct
import payment1 from '../images/payment1.png';
import payment2 from '../images/payment2.png';
import payment3 from '../images/payment3.png';
import payment4 from '../images/payment4.png';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer__container">
        {/* Footer Links Sections */}
        <div className="footer__links">
          {/* Shop Section */}
          <div className="footer__section">
            <h4 className="footer__heading">Shop</h4>
            <ul className="footer__list">
              <li className="footer__item">
                <Link to="/categories/best-seller" className="footer__link">
                  Best Seller
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/categories/shop-men" className="footer__link">
                  Shop Men
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/categories/shop-women" className="footer__link">
                  Shop Women
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/categories/shop-casual" className="footer__link">
                  Shop Casual
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Section */}
          <div className="footer__section">
            <h4 className="footer__heading">Company</h4>
            <ul className="footer__list">
              <li className="footer__item">
                <Link to="/about" className="footer__link">
                  About Us
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/careers" className="footer__link">
                  Careers
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/press" className="footer__link">
                  Press
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div className="footer__section">
            <h4 className="footer__heading">Support</h4>
            <ul className="footer__list">
              <li className="footer__item">
                <Link to="/contact" className="footer__link">
                  Contact Us
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/faq" className="footer__link">
                  FAQ
                </Link>
              </li>
              <li className="footer__item">
                <Link to="/returns" className="footer__link">
                  Returns
                </Link>
              </li>
            </ul>
          </div>

          {/* Payments Section */}
          <div className="footer__section footer__payments">
            <h4 className="footer__heading">Payments</h4>
            <div className="footer__payment-methods">
              <img
                src={payment1}
                alt="Payment Method 1"
                className="footer__payment-img"
              />
              <img
                src={payment2}
                alt="Payment Method 2"
                className="footer__payment-img"
              />
              <img
                src={payment3}
                alt="Payment Method 3"
                className="footer__payment-img"
              />
              <img
                src={payment4}
                alt="Payment Method 4"
                className="footer__payment-img"
              />
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {new Date().getFullYear()} Carlos Shop. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
