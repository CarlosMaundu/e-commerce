// src/components/Header.js

import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchCategories } from '../services/categoryService';
import '../styles/header.css';

import {
  ShoppingCart,
  FavoriteBorder,
  AccountCircle,
  Menu as MenuIcon,
  Close as CloseIcon,
  ExpandMore,
} from '@mui/icons-material';
import { IconButton, Badge, Button } from '@mui/material';
import logo from '../images/logo.png';
import { useSelector } from 'react-redux';

const Header = () => {
  const { user, loading, handleLogout } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const shopDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Access cart and wishlist counts from Redux store
  const cartCount = useSelector((state) => state.cart.items.length);
  const wishlistCount = useSelector((state) => state.wishlist.items.length);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (error) {
        console.error(error.message);
      }
    };

    loadCategories();
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const toggleShopDropdown = () => {
    setShopDropdownOpen((prev) => !prev);
  };

  const toggleUserDropdown = () => {
    setUserDropdownOpen((prev) => !prev);
  };

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        shopDropdownRef.current &&
        !shopDropdownRef.current.contains(event.target)
      ) {
        setShopDropdownOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
      ) {
        setUserDropdownOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShopDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Toggle body class for overlay when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  const handleLinkClick = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
    setShopDropdownOpen(false);
    setUserDropdownOpen(false);
  };

  const handleLogoutClick = () => {
    handleLogout();
    setUserDropdownOpen(false);
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header__container">
        {/* Logo */}
        <div className="header__logo">
          <Link to="/">
            <img src={logo} alt="Logo" />
          </Link>
        </div>

        {/* Navigation */}
        <nav
          className={`header__nav ${mobileMenuOpen ? 'header__nav--open' : ''}`}
        >
          <ul className="header__menu">
            <li
              className="header__dropdown"
              ref={shopDropdownRef}
              onMouseEnter={() => setShopDropdownOpen(true)}
              onMouseLeave={() => setShopDropdownOpen(false)}
            >
              <span
                className="header__dropdown-btn"
                onClick={toggleShopDropdown}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') toggleShopDropdown();
                }}
                aria-haspopup="true"
                aria-expanded={shopDropdownOpen}
              >
                Shop <ExpandMore className="dropdown-icon" />
              </span>
              <ul
                className={`header__dropdown-menu ${
                  shopDropdownOpen ? 'header__dropdown-menu--open' : ''
                }`}
              >
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      to={`/products?category=${category.id}`}
                      onClick={handleLinkClick}
                      className="header__menu-link"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            {/* Menu Items Redirecting to Products Page */}
            <li>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  isActive ? 'active header__menu-link' : 'header__menu-link'
                }
                onClick={handleLinkClick}
              >
                Most Wanted
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  isActive ? 'active header__menu-link' : 'header__menu-link'
                }
                onClick={handleLinkClick}
              >
                New Arrival
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  isActive ? 'active header__menu-link' : 'header__menu-link'
                }
                onClick={handleLinkClick}
              >
                Brands
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* Right Actions */}
        <div className="header__actions">
          {/* Search */}
          <div className="header__search">
            <input type="text" placeholder="Search..." />
          </div>

          {/* Cart */}
          <IconButton component={Link} to="/cart" aria-label="Cart">
            <Badge badgeContent={cartCount} color="secondary">
              <ShoppingCart />
            </Badge>
          </IconButton>

          {/* Wishlist */}
          <IconButton component={Link} to="/wishlist" aria-label="Wishlist">
            <Badge badgeContent={wishlistCount} color="secondary">
              <FavoriteBorder />
            </Badge>
          </IconButton>

          {/* User Account */}
          {loading ? null : user ? (
            <div className="header__user" ref={userDropdownRef}>
              <span className="header__user-greeting">Hi, {user.name}</span>
              <IconButton
                onClick={toggleUserDropdown}
                aria-label="User account"
                className="header__user-icon"
              >
                <AccountCircle />
              </IconButton>
              {userDropdownOpen && (
                <ul
                  className="header__dropdown-menu header__dropdown-menu--user"
                  role="menu"
                  aria-label="User Menu"
                >
                  <li>
                    <Link
                      to="/profile"
                      onClick={handleLinkClick}
                      className="header__menu-link"
                    >
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/orders"
                      onClick={handleLinkClick}
                      className="header__menu-link"
                    >
                      Orders
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={handleLogoutClick}
                      className="header__logout-btn"
                    >
                      Logout
                    </button>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <Button
              component={Link}
              to="/login"
              variant="contained"
              color="primary"
              className="header__login-btn"
            >
              Login
            </Button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <IconButton
          className="header__menu-icon"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
      </div>
    </header>
  );
};

export default Header;
