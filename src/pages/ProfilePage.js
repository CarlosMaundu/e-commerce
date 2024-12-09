// src/pages/ProfilePage.js
import React, { useEffect, useState, useContext, Suspense } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateUserProfile } from '../services/userService';
import Notification from '../notification/notification';
import '../styles/profilePage.css';

import { Container, Row, Col } from 'react-bootstrap';
import {
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { Menu } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';

import ProfileSection from '../components/profile/ProfileSection'; // Regular import for example

// Lazy load other sections
const AddressBookSection = React.lazy(
  () => import('../components/profile/AddressBookSection')
);
const PaymentOptionsSection = React.lazy(
  () => import('../components/profile/PaymentOptionsSection')
);
const OrdersSection = React.lazy(
  () => import('../components/profile/OrdersSection')
);
const WishlistSection = React.lazy(
  () => import('../components/profile/WishlistSection')
);

// For demonstration, these are the same avatar URL and default messages
const defaultAvatarUrl = 'https://imgur.com/a/kIaFC3J';

const ProfilePage = () => {
  const { user, accessToken, loading, updateUser } = useContext(AuthContext);

  // Parse query params with URLSearchParams
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSection = searchParams.get('section') || 'profile';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: '',
  });

  // Form, errors, password fields
  const [formData, setFormData] = useState({
    id: user?.id || '',
    firstName: '',
    lastName: '',
    email: user?.email || '',
    address: user?.address || '',
    avatar: user?.avatar || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (!loading && !user) {
      setNotification({
        open: true,
        message: 'You are not authenticated. Please login.',
        severity: 'error',
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      const nameParts = user.name?.split(' ') || [];
      const firstName = nameParts[0] || user.name || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      setFormData({
        id: user.id,
        firstName,
        lastName,
        email: user.email || '',
        address: user.address || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section') || 'profile';
    setActiveSection(section);
  }, [location]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (showPasswordFields && formData.newPassword.trim()) {
      if (formData.newPassword !== formData.confirmNewPassword) {
        newErrors.confirmNewPassword = 'Passwords do not match';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCancel = () => {
    if (user) {
      const nameParts = user.name?.split(' ') || [];
      const firstName = nameParts[0] || user.name || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      setFormData({
        id: user.id,
        firstName,
        lastName,
        email: user.email || '',
        address: user.address || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setErrors({});
      setShowPasswordFields(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    const fullName =
      `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

    const updateData = {
      id: formData.id,
      name: fullName,
      email: formData.email,
      avatar: formData.avatar,
      address: formData.address,
      password:
        showPasswordFields && formData.newPassword.trim() !== ''
          ? formData.newPassword
          : '',
    };

    try {
      const updatedUser = await updateUserProfile(updateData, accessToken);
      updateUser(updatedUser);
      setNotification({
        open: true,
        message: 'Profile updated successfully.',
        severity: 'success',
      });
      if (showPasswordFields) {
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        });
        setShowPasswordFields(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      if (error.response && error.response.status === 401) {
        setNotification({
          open: true,
          message: 'Profile cannot be modified, contact admin.',
          severity: 'error',
        });
      } else {
        setNotification({
          open: true,
          message: 'An error occurred. Please try again later.',
          severity: 'error',
        });
      }
    }
  };

  const handleNotificationClose = () => {
    setNotification({ ...notification, open: false });
  };

  const isAdmin = user && user.role === 'admin';

  const navigationLinks = [
    {
      header: 'Manage My Account',
      links: [
        {
          name: 'My Profile',
          section: 'profile',
          active: activeSection === 'profile',
        },
        {
          name: 'Address Book',
          section: 'address-book',
          active: activeSection === 'address-book',
        },
        {
          name: 'My Payment Options',
          section: 'payment-options',
          active: activeSection === 'payment-options',
        },
      ],
    },
    {
      header: 'My Orders',
      links: [
        {
          name: 'My Returns',
          section: 'returns',
          active: activeSection === 'returns',
        },
        {
          name: 'My Cancellations',
          section: 'cancellations',
          active: activeSection === 'cancellations',
        },
        {
          name: 'My Orders',
          section: 'orders',
          active: activeSection === 'orders',
        },
      ],
    },
    {
      header: 'My Wishlist',
      links: [
        {
          name: 'Wishlist',
          section: 'wishlist',
          active: activeSection === 'wishlist',
        },
      ],
    },
  ];

  if (isAdmin) {
    navigationLinks.push({
      header: 'Admin Tools',
      links: [
        {
          name: 'User Management',
          section: 'admin-users',
          active: activeSection === 'admin-users',
        },
        {
          name: 'Site Analytics',
          section: 'admin-analytics',
          active: activeSection === 'admin-analytics',
        },
        {
          name: 'Product Management',
          section: 'admin-products',
          active: activeSection === 'admin-products',
        },
        {
          name: 'Category Management',
          section: 'admin-categories',
          active: activeSection === 'admin-categories',
        },
        {
          name: 'Orders Management',
          section: 'admin-orders',
          active: activeSection === 'admin-orders',
        },
      ],
    });
  }

  const renderNavigation = () => (
    <>
      {navigationLinks.map((section, index) => (
        <div key={index}>
          <Typography variant="subtitle1" className="nav-section-header">
            {section.header}
          </Typography>
          <List component="nav">
            {section.links.map((link, idx) => (
              <ListItem
                button
                key={idx}
                className={`nav-link ${link.active ? 'nav-link-active' : ''}`}
                onClick={() => {
                  // Update URL query param
                  const url = new URL(window.location);
                  url.searchParams.set('section', link.section);
                  window.history.pushState({}, '', url);
                  setActiveSection(link.section);
                  if (isMobile) setDrawerOpen(false);
                }}
              >
                <ListItemText primary={link.name} />
              </ListItem>
            ))}
          </List>
          {index < navigationLinks.length - 1 && (
            <Divider className="custom-divider" />
          )}
        </div>
      ))}
    </>
  );

  const renderSectionContent = () => {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        {(() => {
          switch (activeSection) {
            case 'profile':
              return (
                <ProfileSection
                  formData={formData}
                  errors={errors}
                  showPasswordFields={showPasswordFields}
                  showNewPassword={showNewPassword}
                  showConfirmNewPassword={showConfirmNewPassword}
                  handleChange={handleChange}
                  handleSubmit={handleSubmit}
                  handleCancel={handleCancel}
                  setShowPasswordFields={setShowPasswordFields}
                  setShowNewPassword={setShowNewPassword}
                  setShowConfirmNewPassword={setShowConfirmNewPassword}
                  defaultAvatarUrl={defaultAvatarUrl}
                />
              );
            case 'address-book':
              return <AddressBookSection />;
            case 'payment-options':
              return <PaymentOptionsSection />;
            case 'orders':
              return <OrdersSection />;
            case 'wishlist':
              return <WishlistSection />;
            case 'returns':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    My Returns
                  </Typography>
                  <Typography variant="body1">
                    View or initiate product returns.
                  </Typography>
                </>
              );
            case 'cancellations':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    My Cancellations
                  </Typography>
                  <Typography variant="body1">
                    Check the status of your cancellations.
                  </Typography>
                </>
              );
            case 'admin-users':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    User Management (Admin)
                  </Typography>
                  <Typography variant="body1">
                    Manage users of the platform.
                  </Typography>
                </>
              );
            case 'admin-analytics':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    Site Analytics (Admin)
                  </Typography>
                  <Typography variant="body1">
                    View site traffic, sales, and more.
                  </Typography>
                </>
              );
            case 'admin-products':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    Product Management (Admin)
                  </Typography>
                  <Typography variant="body1">
                    Add, edit, or remove products.
                  </Typography>
                </>
              );
            case 'admin-categories':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    Category Management (Admin)
                  </Typography>
                  <Typography variant="body1">
                    Manage product categories.
                  </Typography>
                </>
              );
            case 'admin-orders':
              return (
                <>
                  <Typography variant="h5" className="section-header">
                    Orders Management (Admin)
                  </Typography>
                  <Typography variant="body1">
                    View and manage all customer orders.
                  </Typography>
                </>
              );
            default:
              return <Typography variant="body1">Coming soon...</Typography>;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <div>
      {isMobile && (
        <Container className="profile-page-container">
          <div className="mobile-header">
            <IconButton
              aria-label="Open navigation menu"
              className="mobile-menu-icon"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu />
            </IconButton>
            <Typography variant="h6" className="mobile-header-title">
              Profile
            </Typography>
          </div>
        </Container>
      )}

      <Container className="profile-page-container">
        <Row>
          {!isMobile && (
            <Col md={3} className="sidebar-navigation">
              {renderNavigation()}
            </Col>
          )}

          <Col md={isMobile ? 12 : 9}>{renderSectionContent()}</Col>
        </Row>
        <Notification
          open={notification.open}
          onClose={handleNotificationClose}
          severity={notification.severity}
          message={notification.message}
        />
      </Container>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="drawer-style"
      >
        <div className="drawer-content">{renderNavigation()}</div>
      </Drawer>
    </div>
  );
};

export default ProfilePage;
